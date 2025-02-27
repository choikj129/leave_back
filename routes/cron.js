let express = require("express")
let router = express.Router()
let cron = require("node-cron")
let log4j = require("../exports/log4j")
let holidayKey = require("../exports/config/apiKey").holiday
let funcs = require("../exports/functions")
const axios = require("axios")

// ${process.db}로 동적으로 하려 했지만 Ctrl 추적이 안돼서 기본 값은 그냥 하드코딩 함
let db = require("../exports/oracle")
let holidaySql = require("../oracle/sql_holiday")
let rewardSql = require("../oracle/sql_reward")
if ((process.db || "oracle") != "oracle") {
	db = require(`../exports/${process.db}`)
	holidaySql = require(`../${process.db}/sql_holiday`)
	rewardSql = require(`../${process.db}/sql_reward`)
} 

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
			param.manualYN = "N"
			if (param.dateName == "대체공휴일") {
				if (!param.dateName.endsWith(")")) param.dateName += `(${name})`
			} else name = param.dateName

			return param.isHoliday == "N" ? false : true
		})

		conn = await db.connection()
		const result = await db.updateBulk(conn, holidaySql.updateHoliday, params)
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

const setCarryOver = async (res) => {
	const year = new Date().getFullYear()
	log4j.log("남은 포상, 리프레시 휴가 이월 시작")
	let conn
	try {
		conn = await db.connection()
		const result = await db.select(conn, rewardSql.carryOverRewrad(year), {})

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

/**
 * @swagger
 * /cron/holiday:
 *   put:
 *     summary: 공공 데이터 공휴일 세팅.
 *     description: cron에서 실행되는 것을 수동으로 실행
 *     tags: [Holiday]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *           example: 2025
 *         description: 미 입력 시 올해년도
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
router.put("/holiday", async (req, res, next) => {
	const year = !req.query.year ? new Date().getFullYear() : req.query.year
	setHoliday(year, req, res)
})

cron.schedule("0 0 10 1 2-12 *", async () => {
	// 2월 ~ 12월까지 매달 1일에 올해 공휴일 업데이트
	let year = new Date().getFullYear()
	setHoliday(year)
})

cron.schedule("0 0 0 1 1 *", async () => {
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
