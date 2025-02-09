let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let path = require("path")
let funcs = require("../exports/functions")
const holidayKR = require("holiday-kr")

// ${process.db}로 동적으로 하려 했지만 Ctrl 추적이 안돼서 기본 값은 그냥 하드코딩 함
let db = require("../exports/oracle")
let commonSql = require("../oracle/sql_common")
if ((process.db || "oracle") != "oracle") {
	db = require(`../exports/${process.db}`)
	commonSql = require(`../${process.db}/sql_common`)
} 

router.get("/logout", (req, res, next) => {
	req.session.destroy((err) => {
		if (err) {
			log4j.log(err, "ERROR")
			funcs.sendFail(res, "Logout session destroy Error")
		} else {
			funcs.sendSuccess(res)
		}
	})
})

/**
 * @swagger
 * /download:
 *   get:
 *     summary: 파일 다운로드
 *     tags: [Etc]
 *     parameters:
 *       - in: query
 *         name: fileName
 *         schema:
 *           type: string
 *           example: sampleExcel.xlsx
 *         required: true
 *         description: 파일 명명
 *     responses:
 *       200:
 *         content:
 *           attachment:
 *             schema:
 *               type: file
 */
router.get("/download", (req, res, next) => {
	const filePath = `${__dirname}/../public/files/`
	let fileName = req.query.fileName
	const file = filePath + fileName
		
	res.download(path.resolve(file), fileName, (result, err) => {
		if (err) {
			log4j.log(err, "ERROR")
		}
	})
})

/**
 * @swagger
 * /code:
 *   get:
 *     summary: 공통 코드 조회
 *     tags: [Etc]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *           example: 직위
 *         required: true
 *         description: 공통 코드의 구분 값
 *       - in: query
 *         name: reverse
 *         schema:
 *           type: string
 *           example: DESC
 *         required: false
 *         description: 코드명 기준 정렬 조건
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
 *                       코드명:
 *                         type: string
 *                         example: Z
 *                       표시내용:
 *                         type: string
 *                         example: 관리자
 */
router.get("/code", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const sort = req.query.reverse != undefined && req.query.reverse ? "DESC" : "ASC"
		const result = await db.select(conn, commonSql.selectCommonCode(sort), {name : req.query.name})
		funcs.sendSuccess(res, result)
	} catch (e) {
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /birthday:
 *   get:
 *     summary: 직원 생일 조회
 *     description: 3년치 (작년, 올해, 내년) 생일 조회
 *     tags: [Etc]
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
 *                       내용:
 *                         type: string
 *                         example: 어다인 2025년 11월 16일 생일🎉
 *                         description: 이름 + 년월일 + 생일
 *                       생일:
 *                         type: string
 *                         example: 2025-11-16
 *                         description: yyyy-mm-dd
 *                       음력여부:
 *                         type: boolean
 *                         example: false
 */
router.get("/birthday", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const result = await db.select(conn, commonSql.selectEmpBirthday, {})

		const year = new Date().getFullYear()				
		
		let birthdays = []
		for (i=0; i<result.length; i++) {
			let birthday = result[i]
			if (!birthday.생일) continue
			if (birthday.음력여부 == 'N') {
				let month = birthday.생일.substring(0, 2)
				let day = birthday.생일.substring(2, 4)
				for (let n=-1; n<2; n++) {
					birthdays.push({
						내용 : `${birthday.이름} ${month}월 ${day}일 생일🎉`,
						생일 : `${(year + n)}-${month}-${day}`,
						음력여부 : false
					})
				}
			} else {
				let month = birthday.생일.substring(0, 2)
				let day = birthday.생일.substring(2, 4)
				for (let n=-1; n<2; n++) {
					let solar
					try {
						solar = await holidayKR.getSolar(year + n, month, day, true)
					} catch {
						try {
							solar = await holidayKR.getSolar(year + n, month, day, false)
						} catch {}
					} finally {
						if (solar) {
							let solarMonth = solar.month < 10 ? "0" + solar.month : solar.month.toString()
							let solarDay = solar.day < 10 ? "0" + solar.day : solar.day.toString()
							birthdays.push({
								내용 : `${birthday.이름} 음력 ${month}월 ${day}일 생일🎉`,
								생일 : `${solar.year}-${solarMonth}-${solarDay}`,
								음력여부 : true,
							})
						}
					}
				}
			}
		}		
		funcs.sendSuccess(res, birthdays)
	} catch (e) {
		console.error(e)
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /test:
 *   post:
 *     summary: 접속 테스트 용
 *     tags: [Etc]
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
router.post("/test", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		result = []
		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

module.exports = router
