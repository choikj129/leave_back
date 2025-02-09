let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let kakaowork = require("../exports/kakaowork")
let funcs = require("../exports/functions")

// ${process.db}로 동적으로 하려 했지만 Ctrl 추적이 안돼서 기본 값은 그냥 하드코딩 함
let db = require("../exports/oracle")
let commonSql = require("../oracle/sql_common")
if ((process.db || "oracle") != "oracle") {
	db = require(`../exports/${process.db}`)
	commonSql = require(`../${process.db}/sql_common`)
} 

/**
 * @swagger
 * /login:
 *   post:
 *     summary: 로그인
 *     tags: [Login]
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
 *               pw:
 *                 type: string
 *                 example: test1234
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: test
 *                       description: 아이디
 *                     name:
 *                       type: string
 *                       example: 테스트
 *                       description: 이름
 */
router.post("/", async (req, res, next) => {	
	let conn
	const userAgent = req.get('User-Agent')
	try {
		conn = await db.connection()
		const pw = funcs.encrypt(req.body.pw)
		const params = { id: req.body.id, pw: pw }
		const result = await db.select(conn, commonSql.selectEmpInfo, params)
		if (result.length == 0) {
			funcs.sendFail(res, "로그인 정보 없음")
		} else {
			const data = result[0]
			req.session.user = {
				id: data.아이디,
				name: data.이름,
				position: data.직위,
				isManager : data.관리자여부 == "Y" ? true : false,
				isLogin : true,
				isMobile : /mobile/i.test(userAgent),
			}

			funcs.sendSuccess(res, req.session.user)
		}
		log4j.log(`(${req.body.id}) - User-Agent : ${userAgent}`, "INFO")
	} catch (e) {
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

/* 비밀번호 변경 */
router.patch("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const pw = funcs.encrypt(req.body.pw)		
		const params = { id: req.body.id, pw: pw }
		const result = await db.update(conn, commonSql.updatePassword, params)

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

/* 비밀번호 초기화 */
router.patch("/reset", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		
		let params = { id : req.body.id, name : req.body.name }
		const result = await db.select(conn, commonSql.selectEmpEmail, params)
		
		if (result.length == 0) {
			funcs.sendFail(res, "사용자가 존재하지 않습니다.")
			return
		}
		const email = result[0].이메일
		const userId = await kakaowork.getUserId(email)
		if (!userId) {
			funcs.sendFail(res, `카카오워크 이메일(${email})을 찾을 수 없습니다.`)
			return
		}
		const convId = await kakaowork.conversationOpen(userId)
		if (!convId) {
			funcs.sendFail(res, "카카오워크를 전송 오류.")
			return
		}
		
		const key = funcs.randomChar()
		const pw = funcs.encrypt(key)
		params.pw = pw
		await db.update(conn, commonSql.updatePassword, params)

		await kakaowork.sendMessage(`휴가웹 임시 비밀번호\n${key}`, convId)
		
		await db.commit(conn)
		funcs.sendSuccess(res, [], "임시 비밀번호를 카카오워크로 전송했습니다.")
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

module.exports = router
