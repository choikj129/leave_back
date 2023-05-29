let express = require("express")
let router = express.Router()
let db = require("../exports/oracle")
let funcs = require("../exports/functions")

/* 공휴일 목록 불러오기 */
router.get("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const sql = `
			SELECT 명칭, TO_CHAR(MIN(날짜), 'YYYY-MM-DD') 시작일, TO_CHAR(MAX(날짜), 'YYYY-MM-DD') 종료일, 수동여부
			FROM HOLIDAY
			WHERE
				연도 = :year
			GROUP BY 명칭, 수동여부
			ORDER BY 시작일
		`
		const result = await db.select(conn, sql, req.query)
		funcs.sendSuccess(res, result)
	} catch (e) {
		funcs.sendFail(res, e)
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
			SELECT 명칭, TO_CHAR(날짜,'YYYY') 년, TO_CHAR(날짜,'MM') 월, TO_CHAR(날짜,'DD') 일
			FROM HOLIDAY
			WHERE 연도 > TO_CHAR(SYSDATE - (INTERVAL '3' YEAR), 'YYYY')
			ORDER BY 날짜
		`
		const result = await db.select(conn, sql, req.query)
		funcs.sendSuccess(res, result)
	} catch (e) {
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

/* 공휴일 상세 목록 불러오기 */
router.put("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()		
		const sql = `
			INSERT INTO HOLIDAY (명칭, 날짜, 연도, 수동여부)
            VALUES (:name, TO_DATE(:holiday, 'YYYYMMDD'), :year, 'Y')
		`
        console.log(req.body.holidays)
		const result = await db.updateBulk(conn, sql, req.body.holidays)
        await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch (e) {
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

module.exports = router
