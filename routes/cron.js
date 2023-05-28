let express = require("express")
let router = express.Router()
let db = require("../exports/oracle")
let funcs = require("../exports/functions")
let today = new Date()
const axios = require("axios")

/* 공휴일 목록 불러오기 */
router.get("/holiday", async (req, res, next) => {
	// 공휴일 api키 가져오기
	let conn
	try {
		conn = await db.connection()
		const sql = `SELECT 표시내용 KEY FROM CODE WHERE 코드구분 = '공공데이터키' AND 사용여부 = 'Y' ORDER BY 코드명`
		const rows = await db.select(conn, sql) 
	} catch (e){
		console.error(e)
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
    const thisYear = req.query.year
    let url = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo'
    let numOfRows = '100'
    let solYear = thisYear == null ? today.getFullYear() : thisYear 
    let _type = 'json'
    let response = await axios.get(url,{
        headers : {
            'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': '*/*'
        }, params : {
            numOfRows : numOfRows,
            solYear : solYear,
            ServiceKey : holidayKey,
            _type : _type
        }
    })

	try {
		conn = await db.connection()
		const sql =
			`
				MERGE INTO HOLIDAY a
				USING DUAL
					ON (a.날짜 = to_date(:locdate,'YYYY-MM-DD'))
				WHEN NOT MATCHED THEN
					INSERT (a.명칭, a.휴일여부, a.날짜, a.수정일자)
					VALUES (:dateName, :isHoliday, to_date(:locdate,'YYYY-MM-DD'),sysdate)
			`
		const result = await db.updateBulk(conn, sql,response.data.response.body.items.item)
		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch (e){
		await db.rollback(conn)
		console.error(e)
		funcs.sendFail(res, e)
	} finally{
		db.close(conn)
	}
})

router.put("/carry-over", async (req, res, next) => {	
	/* TO-DO
		미사용 & 만료 안 된 포상, 리프레시 휴가 이월	
	*/
})

module.exports = router
