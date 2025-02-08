let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let db = require("../exports/oracle")
let funcs = require("../exports/functions")

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
		const sql = `
			SELECT 
				명칭,
				수동여부,
				TO_CHAR(TO_DATE(MIN(날짜), 'YYYYMMDD'), 'YYYY-MM-DD') 시작일,
				TO_CHAR(TO_DATE(MAX(날짜), 'YYYYMMDD'), 'YYYY-MM-DD') 종료일
			FROM HOLIDAY
			WHERE 날짜 LIKE :year || '%'
			GROUP BY 명칭, 수동여부
			ORDER BY 시작일
		`
		const result = await db.select(conn, sql, req.query)
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
 */
router.get("/detail", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const sql = `
			SELECT 명칭, 날짜
			FROM HOLIDAY
			WHERE 날짜 > TO_CHAR(ADD_MONTHS(SYSDATE, -12), 'YYYY')
			ORDER BY 날짜		
		`
		const result = await db.select(conn, sql, req.query)
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
 *             type: object
 *             required:
 *               - name
 *               - holiday
 *             properties:
 *               name:
 *                 type: string
 *                 example: 대체공휴일
 *               holiday:
 *                 type: string
 *                 example: 20250127
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
		const sql = `
			INSERT INTO HOLIDAY (명칭, 날짜, 수동여부)
            VALUES (:name, :holiday, 'Y')
		`
		const result = await db.updateBulk(conn, sql, req.body.holidays)
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
 *             required:
 *               - name
 *               - year
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
		const sql = `
			DELETE FROM HOLIDAY
			WHERE
				명칭 = :name
				AND 날짜 LIKE :year || '%'
		`
		const result = await db.update(conn, sql, req.body)
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
