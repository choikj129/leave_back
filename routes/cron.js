let express = require("express")
let router = express.Router()
let cron = require("node-cron")
let log4j = require("../exports/log4j")
let holidayKey = require("../exports/config/apiKey").holiday
let funcs = require("../exports/functions")
let cronJob = require("../exports/cronJob")
let moment = require("moment")
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

/*
	정기 작업은 실패 시 재시도되므로 실패하면 throw
	commit은 db.commit()이 오류를 무시하므로 conn.commit() 직접 호출
*/

/* 공휴일 목록 불러오기 */
const setHoliday = async (year) => {
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

	let conn
	try {
		conn = await db.connection()
		const result = await db.updateBulk(conn, holidaySql.updateHoliday, params)
		await conn.commit()
		log4j.log(`${year}년 공휴일 등록 완료`)
		return result
	} catch (e) {
		if (conn) await db.rollback(conn)
		throw e
	} finally {
		if (conn) db.close(conn)
	}
}

/* 남은 포상, 리프레시 휴가 이월 (이미 이월된 건은 제외되므로 재실행 가능) */
const setCarryOver = async (year) => {
	log4j.log(`${year}년 남은 포상, 리프레시 휴가 이월 시작`)
	let conn
	try {
		conn = await db.connection()
		const result = await db.update(conn, rewardSql.carryOverRewrad(year), {})
		await conn.commit()
		log4j.log(`${year}년 남은 포상, 리프레시 휴가 이월 완료 (${result}건)`)
		return result
	} catch (e) {
		if (conn) await db.rollback(conn)
		throw e
	} finally {
		if (conn) db.close(conn)
	}
}

/* 수동 실행 API 응답 */
const sendResult = async (res, fn) => {
	try {
		funcs.sendSuccess(res, await fn())
	} catch (e) {
		console.error(e)
		funcs.sendFail(res, e)
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
	sendResult(res, () => setHoliday(year))
})

router.put("/carry-over", async (req, res, next) => {
	sendResult(res, () => setCarryOver(new Date().getFullYear()))
})

/* 정기 작업 (실패 시 10분마다 재시도, 서버 중단 중 놓친 작업은 기동 시 실행) */
cronJob.start([
	{
		// 매월 1일 10:00 올해 공휴일 업데이트, 1월은 00:00에 올해 + 내년
		name : "공휴일 등록",
		key : (now) => `holiday-${moment(now).format("YYYY-MM")}`,
		dueAt : (now) => moment(now).startOf("month").hour(now.getMonth() == 0 ? 0 : 10).toDate(),
		run : async (now) => {
			await setHoliday(now.getFullYear())
			if (now.getMonth() == 0) await setHoliday(now.getFullYear() + 1)
		},
	},
	{
		// 매년 1월 1일 10:00 남은 포상, 리프레시 휴가 이월. 1월 중에만 재시도
		name : "포상/리프레시 휴가 이월",
		key : (now) => `carryOver-${now.getFullYear()}`,
		dueAt : (now) => moment(now).startOf("year").hour(10).toDate(),
		until : (now) => moment(now).startOf("year").add(1, "month").toDate(),
		run : (now) => setCarryOver(now.getFullYear()),
	},
])

module.exports = router
