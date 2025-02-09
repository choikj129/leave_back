var express = require("express")
var router = express.Router()
let log4j = require("../exports/log4j")
let funcs = require("../exports/functions")

// ${process.db}로 동적으로 하려 했지만 Ctrl 추적이 안돼서 기본 값은 그냥 하드코딩 함
let db = require("../exports/oracle")
let usersSql = require("../oracle/sql_users")
let leaveSql = require("../oracle/sql_leave")
if ((process.db || "oracle") != "oracle") {
	db = require(`../exports/${process.db}`)
	usersSql = require(`../${process.db}/sql_users`)
	leaveSql = require(`../${process.db}/sql_leave`)
} 

/**
 * @swagger
 * /users:
 *   get:
 *     summary: 해당 연도 직원 목록 조회
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *           example: 2025
 *         required: true
 *         description: 기준연도
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   아이디:
 *                     type: string
 *                     example: test
 *                   이름:
 *                     type: string
 *                     example: 테스트
 *                   직위코드:
 *                     type: string
 *                     example: I
 *                   직위:
 *                     type: string
 *                     example: 주임
 *                   입사일:
 *                     type: string
 *                     example: 20240104
 *                   관리자여부:
 *                     type: string
 *                     example: N
 *                     description: Y or N
 *                   생일:
 *                     type: string
 *                     example: 19190301
 *                   음력여부:
 *                     type: string
 *                     example: N
 *                     description: Y or N
 *                   연도:
 *                     type: string
 *                     example: 2025
 *                     description: 기준연도
 *                   휴가수:
 *                     type: int
 *                     example: 15
 *                     description: 부여받은 연차 수
 *                   이월휴가수:
 *                     type: int
 *                     example: 5
 *                     description: 이월된 연차 수
 *                   사용휴가수:
 *                     type: int
 *                     example: 1
 *                     description: 사용한 연차 수
 *                   기타휴가수:
 *                     type: int
 *                     example: 3
 *                     description: 사용한 기타 휴가 수
 *                   리프레시휴가수:
 *                     type: int
 *                     example: 5
 *                     description: 부여받은 리프레시 휴가 수
 *                   사용리프레시휴가수:
 *                     type: int
 *                     example: 0
 *                     description: 사용한 리프레시 휴가 수
 *                   포상휴가수:
 *                     type: int
 *                     example: 5
 *                     description: 부여받은 포상 휴가 수
 *                   사용포상휴가수:
 *                     type: int
 *                     example: 0
 *                     description: 사용한 포상 휴가 수
 *                   추가휴가수:
 *                     type: int
 *                     example: 10
 *                     description: 부여받은 포상 + 리프레시 휴가 수
 *                   사용추가휴가수:
 *                     type: int
 *                     example: 0
 *                     description: 사용한 포상 + 리프레시 휴가 수
 *                   입사년차:
 *                     type: int
 *                     example: 1
 */
router.get("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()

		let params = {year : req.query.year}
		let whereId = ""
		const userSession = req.session.user
		if (!userSession.isManager) {
			whereId = "AND E.아이디 = :id"
			params.id = userSession.id
		}
		
		const result = await db.select(conn, usersSql.selectUsersInfo(whereId), params)

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /users:
 *   patch:
 *     summary: 직원 정보 수정
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: test
 *               position:
 *                 type: string
 *                 example: H
 *                 description: 공통 코드에 정의된 직위 코드
 *               joinDate:
 *                 type: string
 *                 example: 20220103
 *                 description: 입사일
 *               isLunar:
 *                 type: string
 *                 example: N
 *                 description: 음력여부 (Y or N)
 *               birthday:
 *                 type: string
 *                 example: 19450815
 *                 description: 생일
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 msg:
 *                   type: string
 */
router.patch("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()		
		const result = await db.update(conn, usersSql.updateUserInfo, req.body)

		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /users:
 *   put:
 *     summary: 직원 추가
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: test
 *               name:
 *                 type: string
 *                 example: 테스트
 *               position:
 *                 type: string
 *                 example: H
 *                 description: 공통 코드에 정의된 직위 코드
 *               joinDate:
 *                 type: string
 *                 example: 20220103
 *                 description: 입사일
 *               isLunar:
 *                 type: string
 *                 example: N
 *                 description: 음력여부 (Y or N)
 *               birthday:
 *                 type: string
 *                 example: "0101"
 *                 description: 생일
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 msg:
 *                   type: string
 */
router.put("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		req.body.isLunar = req.body.isLunar ? "Y" : "N"
		const result = await db.update(conn, usersSql.insertUser, req.body)

		await db.commit(conn)
		result == 0 ? funcs.sendFail(res, "중복된 아이디입니다.") : funcs.sendSuccess(res, result)		
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /users:
 *   delete:
 *     summary: 직원 삭제
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: test
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 msg:
 *                   type: string
 */
router.delete("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const result = await db.update(conn, usersSql.deleteUser, req.body)

		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /users/insertExcelUsers:
 *   put:
 *     summary: 다 수의 직원 추가
 *     description: 엑셀로 업로드 할 때 사용
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: test
 *                 아이디:
 *                   type: string
 *                   example: test
 *                 name:
 *                   type: string
 *                   example: 테스트
 *                 position:
 *                   type: string
 *                   example: H
 *                   description: 공통 코드에 정의된 직위 코드
 *                 joinDate:
 *                   type: string
 *                   example: 20220103
 *                   description: 입사일
 *                 isLunar:
 *                   type: string
 *                   example: N
 *                   description: 음력여부 (Y or N)
 *                 birthday:
 *                   type: string
 *                   example: "0101"
 *                   description: 생일
 *                 기준연도:
 *                   type: string
 *                   example: 2025
 *                   description: 휴가기준연도
 *                 휴가수:
 *                   type: int
 *                   example: 15
 *                   description: 부여 할 연차 수
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 msg:
 *                   type: string
 */
router.put("/insertExcelUsers", async (req, res, next) => {
	let conn
	try {
		const requestUsersSize = req.body.length
		conn = await db.connection()

		console.log(req.body)
		const result = await db.multiUpdateBulk(conn, {
			insertUsers : {query : usersSql.insertUser, params: req.body}, 
			insertLeaveCnt : {query : leaveSql.updateLeaveCnt, params: req.body}, 
		})

		const acceptUsersSize = result.insertUsers

		
		if (acceptUsersSize != requestUsersSize) {
			throw `\n입력 직원 수 = ${requestUsersSize}\nDB 적재 건수 = ${acceptUsersSize}\n사유 : 중복아이디 혹은 기타 알 수 없는 이유\nDB 롤백 진행.`
		}
		
		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})

module.exports = router
