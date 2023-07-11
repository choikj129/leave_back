let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let db = require("../exports/oracle")
let holidayKey = require("../exports/config/apiKey").holiday
let funcs = require("../exports/functions")
let today = new Date()
const axios = require("axios")

/* 공휴일 목록 불러오기 */
router.get("/holiday", async (req, res, next) => {
	// 공휴일 api키 가져오기
	let conn
	try {
		// const selectCode = `SELECT 표시내용 KEY FROM CODE WHERE 코드구분 = '공공데이터키' AND 사용여부 = 'Y'`
		// const rows = await db.select(conn, selectCode, {})

		const year = !req.query.year ? today.getFullYear() : req.query.year
		const numOfRows = '100'
		const _type = 'json'
		const url = `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo?numOfRows=${numOfRows}&_type=${_type}&solYear=${year}&ServiceKey=${holidayKey}`
		
		let holiday = await axios.get(url, {
			headers : {
				'Content-type': 'application/json;charset=UTF-8',
				'Accept': '*/*'
			}
		})
		
		let name = ""
		const params = holiday.data.response.body.items.item.filter(param => {
			if (param.dateName == "대체공휴일") {
				if (!param.dateName.endsWith(")")) param.dateName += `(${name})`
			} else name = param.dateName

			return param.isHoliday == "N" ? false : true
		})

		conn = await db.connection()
		const insertHoliday =`
			MERGE INTO HOLIDAY H
			USING DUAL
				ON (
					명칭 = :dateName
					AND 날짜 = :locdate
				)
			WHEN MATCHED THEN
				UPDATE SET 수정일자 = SYSDATE
			WHEN NOT MATCHED THEN
				INSERT (명칭, 날짜)
				VALUES (:dateName, :locdate)
		`
		const result = await db.updateBulk(conn, insertHoliday, params)
		await db.commit(conn)
		funcs.sendSuccess(res, result)

	} catch (e){
		await db.rollback(conn)
		log4j.log(e, "ERROR")
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

router.put("/carry-over", async (req, res, next) => {	
	/* TO-DO
		미사용 & 만료 안 된 포상, 리프레시 휴가 이월	
	*/
	// const year = new Date().getFullYear()
	const year = 2024
	let conn
	try {
		conn = await db.connection()
		const insert = `
			INSERT INTO REWARD (
				IDX, 아이디, 휴가유형, 휴가일수, 등록일, 만료일, 사용일수, 기준연도, ROOT_IDX
			)
			SELECT SEQ_REWARD.NEXTVAL, 아이디, 휴가유형, 휴가일수 - 사용일수, 등록일, 만료일, 0, ${year}, IDX
			FROM REWARD
			WHERE 
				기준연도 = TO_CHAR(${year} - 1)
				AND 휴가일수 > 사용일수
				AND 만료일 >= ${year} || '0101'
		`
		const result = await db.select(conn, insert, {})

		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch (e) {
		await db.rollback(conn)
		log4j.log(e, "ERROR")
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

module.exports = router
