let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let funcs = require("../exports/functions")

// ${process.db}로 동적으로 하려 했지만 Ctrl 추적이 안돼서 기본 값은 그냥 하드코딩 함
let db = require("../exports/oracle")
let holidaySql = require("../oracle/sql_holiday")
if ((process.db || "oracle") != "oracle") {
	db = require(`../exports/${process.db}`)
	holidaySql = require(`../${process.db}/sql_holiday`)
} 

/**
 * @swagger
 * /holiday:
 *   get:
 *     summary: 공휴일 조회
 *     tags: [Holiday]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *           example: 2025
 *         required: true
 *         description: 년도
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       명칭:
 *                         type: string
 *                         example: 1월1일
 *                       수동여부:
 *                         type: string
 *                         example: N
 *                         description: Y or N
 *                       시작일:
 *                         type: string
 *                         example: 20250101
 *                       종료일:
 *                         type: string
 *                         example: 20250101
 */
router.get("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const result = await db.select(conn, holidaySql.selectHolidays, req.query)
		funcs.sendSuccess(res, result)
	} catch (e) {
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /holiday/detail:
 *   get:
 *     summary: 공휴일 상세 조회
 *     description: 로그인 시 캘린더에서 사용할 공휴일 store에 저장
 *     tags: [Holiday]
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       명칭:
 *                         type: string
 *                         example: 1월1일
 *                       날짜:
 *                         type: string
 *                         example: 20250101
 *                         description: yyyymmdd
 */
router.get("/detail", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const result = await db.select(conn, holidaySql.selectDetailHolidays, req.query)
		funcs.sendSuccess(res, result)
	} catch (e) {
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /holiday:
 *   put:
 *     summary: 공휴일 추가
 *     description: 캘린더에 없는 휴일 추가
 *     tags: [Holiday]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 dateName:
 *                   type: string
 *                   example: 대체공휴일
 *                 locdate:
 *                   type: string
 *                   example: 20250127
 *                   description: yyyymmdd
 *                 manualYN:
 *                   type: string
 *                   example: Y
 *                   description: 수동 추가 여부
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
		const result = await db.updateBulk(conn, holidaySql.updateHoliday, req.body)
        await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch (e) {
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /holiday:
 *   delete:
 *     summary: 공휴일 삭제
 *     description: 수동 추가한 공휴일 삭제
 *     tags: [Holiday]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: 설날 대체공휴일
 *               year:
 *                 type: string
 *                 example: 2025
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
		const result = await db.update(conn, holidaySql.deleteHoliday, req.body)
        await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch (e) {
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

module.exports = router
