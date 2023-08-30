let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let db = require("../exports/oracle")
let funcs = require("../exports/functions")

/* 공휴일 목록 불러오기 */
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

/* 공휴일 상세 목록 불러오기 */
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

/* 공휴일 수동 삽입 */
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

/* 공휴일 삭제 */
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
