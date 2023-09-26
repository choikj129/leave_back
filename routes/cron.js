let express = require("express")
let router = express.Router()
let cron = require("node-cron")
let log4j = require("../exports/log4j")
let db = require("../exports/oracle")
let holidayKey = require("../exports/config/apiKey").holiday
let funcs = require("../exports/functions")
const axios = require("axios")

/* 공휴일 목록 불러오기 */
const setHoliday = async (year, req, res) => {
	let conn
	if (!year) {
		log4j.log("year 입력 필요", "ERROR")
	}
	try {
		log4j.log(`${year}년 공휴일 등록 시작`)
		
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
					날짜 = :locdate
				)
			WHEN MATCHED THEN
				UPDATE SET 수정일자 = SYSDATE
			WHEN NOT MATCHED THEN
				INSERT (명칭, 날짜)
				VALUES (:dateName, :locdate)
		`
		const result = await db.updateBulk(conn, insertHoliday, params)
		await db.commit(conn)
		req ? funcs.sendSuccess(res, result) : log4j.log("공휴일 등록 완료")

	} catch (e){
		await db.rollback(conn)
		console.error(e)
		req ? funcs.sendFail(res, e) : log4j.log("공휴일 등록 실패")
	} finally {
		db.close(conn)
	}
}

/* TO-DO
	미사용 & 만료 안 된 포상, 리프레시 휴가 이월	
*/
const setCarryOver = async (res) => {
	const year = new Date().getFullYear()
	log4j.log("남은 포상, 리프레시 휴가 이월 시작")
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
				기준연도 = TO_CHAR(${year - 1})
				AND 휴가일수 > 사용일수
				AND 만료일 >= ${year} || '0101'
		`
		const result = await db.select(conn, insert, {})

		await db.commit(conn)

		res ? funcs.sendSuccess(res, result) : log4j.log("남은 포상, 리프레시 휴가 이월 완료")
	} catch (e) {
		await db.rollback(conn)
		console.error(e)
		res ? funcs.sendFail(res, e) : log4j.log("남은 포상, 리프레시 휴가 이월 실패")
	} finally {
		db.close(conn)
	}
}

router.get("/holiday", async (req, res, next) => {
	const year = !req.query.year ? new Date().getFullYear() : req.query.year
	setHoliday(year, req, res)
})

cron.schedule("0 0 10 1 2-12 *", async () => {
	// 2월 ~ 12월까지 매달 1일에 올해 공휴일 업데이트
	let year = new Date().getFullYear()
	setHoliday(year)
})

cron.schedule("0 0 10 1 1 *", async () => {
	// 매년 1월 1일에 올해, 내년 공휴일 업데이트
	let year = new Date().getFullYear()
	await setHoliday(year)
	setHoliday(year + 1)
})

cron.schedule("0 0 10 1 1 *", async () => {
	setCarryOver()
})

router.put("/carry-over", async (req, res, next) => {	
	setCarryOver(res)	
})

module.exports = router
