let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
const funcs = require("../exports/functions")

// ${process.db}로 동적으로 하려 했지만 Ctrl 추적이 안돼서 기본 값은 그냥 하드코딩 함
let db = require("../exports/oracle")
if ((process.db || "oracle") != "oracle") {
	db = require(`../exports/${process.db}`)
} 

/**
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
router.get("/code", db.transaction(async (req, res, conn) => {
	const sql = `
		SELECT 표시내용 KEY
		FROM CODE
		WHERE
			코드구분 = '공공데이터키'
			AND 사용여부 = 'Y'
		ORDER BY 코드명
	`
	const rows = await db.select(conn, sql, {})
	console.log(rows)
	return rows
}, { readOnly: true }))


/**
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
router.patch('/update', (req, res, next) => {
	// 키 값 없을 시 실행 안함
	if(req.body.key == undefined || req.body.key === ""){
		funcs.sendFail(res, "key값 없음")
		return
	}
	next()
}, db.transaction(async (req, res, conn) => {
	const sql = `
		UPDATE CODE SET
			표시내용 = :key
		WHERE
		코드구분 = '공공데이터키'
	`
	return await db.update(conn, sql, {key:req.body.key})
}))

module.exports = router
