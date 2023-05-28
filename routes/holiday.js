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
            SELECT 명칭, TO_CHAR(MIN(날짜), 'YYYY-MM-DD')시작일, TO_CHAR(MAX(날짜), 'YYYY-MM-DD') 종료일
            FROM HOLIDAY
            WHERE
                휴일여부 = 'Y'   		
                AND 날짜 BETWEEN TO_DATE(:year || '0101', 'YYYYMMDD') AND TO_DATE(:year || '1231', 'YYYYMMDD')
            GROUP BY 명칭
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
			SELECT 명칭, 휴일여부, TO_CHAR(날짜,'YYYY') 년, TO_CHAR(날짜,'MM') 월, TO_CHAR(날짜,'DD') 일
			FROM HOLIDAY
			WHERE 
				휴일여부 = 'Y'
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
			INSERT INTO HOLIDAY (명칭, 날짜)
            VALUES (:name, TO_DATE(:holiday, 'YYYYMMDD'))
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
