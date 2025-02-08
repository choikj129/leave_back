let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
const db = require("../exports/oracle")
const funcs = require("../exports/functions")

/**
 * @swagger
 * /api/code:
 *   get:
 *     summary: 공공 데이터 키 조회
 *     tags: [Api]
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
 *                       KEY:
 *                         type: string
 */
router.get("/code", async (req, res, next) => {
	let  conn 
		try {
			conn = await db.connection()
			const sql = `SELECT 표시내용 KEY FROM CODE WHERE 코드구분 = '공공데이터키' AND 사용여부 = 'Y' ORDER BY 코드명`
			const rows = await db.select(conn, sql, {})
			funcs.sendSuccess(res, rows)
		} catch (e){
			db.rollback(conn)
			console.error(e)
			funcs.sendFail(res, e)
		} finally {
			db.close(conn)
	}
})


/**
 * @swagger
 * /api/update:
 *   patch:
 *     summary: 공공 데이터 키 수정
 *     tags: [Api]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *             properties:
 *               key:
 *                 type: string
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
router.patch('/update', async (req, res, next) => {
	const param = req.body
	// 키 값 없을 시 실행 안함
	if(param.key == undefined || param.key === ""){
		funcs.sendFail(res, "key값 없음")
		return
	}
	const sql = `
		UPDATE CODE SET
			표시내용 = :key
		WHERE
		코드구분 = '공공데이터키'
	`
	const updParam = {key:param.key}
	let conn
	try {
		conn = await db.connection()
		const rows = await db.update(conn, sql, updParam)
		await db.commit(conn)
		funcs.sendSuccess(res, rows)
	} catch (e){
		await db.rollback(conn)
		console.error(e)
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

module.exports = router
