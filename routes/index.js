let express = require("express")
let router = express.Router()
let path = require("path")
let db = require("../exports/oracle")
let funcs = require("../exports/functions")
const holidayKR = require("holiday-kr")

router.get("/logout", (req, res, next) => {
	req.session.destroy((err) => {
		if (err) {
			console.error(err)
			funcs.sendFail(res, "Logout session destroy Error")
		} else {
			funcs.sendSuccess(res)
		}
	})
})

router.get("/download", (req, res, next) => {
	const filePath = `${__dirname}/../public/files/`
	let fileName = "어다인_휴가관리_사용자_매뉴얼.pdf"
	if (req.session.user.isManager) {
			fileName = "어다인_휴가관리_관리자_매뉴얼.pdf"
		}
	const file = filePath + fileName
		
	res.download(path.resolve(file), fileName, (result, err) => {
		if (err) {
			console.error(err)
		}
	})
})

router.get("/code", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const sort = req.query.reverse != undefined && req.query.reverse ? "DESC" : "ASC"
		const sql = `
			SELECT 코드명, 표시내용 
			FROM CODE 
			WHERE 코드구분 = :name AND 사용여부 = 'Y' 
			ORDER BY 코드명 ${sort}
		`
		const result = await db.select(conn, sql, {name : req.query.name})
		funcs.sendSuccess(res, result)
	} catch (e) {
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

router.get("/birthday", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const selectBirthday = `
			SELECT 
				이름 || ' ' || 직위 이름,
				생일,
				음력여부
			FROM EMP_POS`
		const selectKey = `SELECT 표시내용 KEY FROM CODE WHERE 코드구분 = '공공데이터키' AND 사용여부 = 'Y'`
		
		const result = await db.multiSelect(conn, {
			birthdays : {query : selectBirthday, params : {}},
			apiKey : {query : selectKey, params : {}},
		})

		
		const year = new Date().getFullYear()				
		
		let birthdays = []
		for (i=0; i<result.birthdays.length; i++) {
			let birthday = result.birthdays[i]
			if (!birthday.생일) continue
			if (birthday.음력여부 == 'N') {
				let month = birthday.생일.substring(0, 2)
				let day = birthday.생일.substring(2, 4)
				for (let n=-1; n<2; n++) {
					birthdays.push({
						내용 : `${birthday.이름} ${month}월 ${day}일 생일`,
						생일 : `${(year + n)}-${month}-${day}`,
						음력여부 : false
					})
				}
			} else {
				let month = birthday.생일.substring(0, 2)
				let day = birthday.생일.substring(2, 4)
				for (let n=-1; n<2; n++) {
					try {
						let solar = await holidayKR.getSolar(year + n, month, day, true)
						console.log(birthday.이름, solar, true)
						let solarMonth = solar.month < 10 ? "0" + solar.month : solar.month.toString()
						let solarDay = solar.dat < 10 ? "0" + solar.dat : solar.dat.toString()
						birthdays.push({
							내용 : `${birthday.이름} 음력 ${month}월 ${day}일 생일`,
							생일 : `${solar.year}-${solarMonth}-${solarDay}`,
							음력여부 : true,
						})
					} catch {
						try {
							let solar = await holidayKR.getSolar(year + n, month, day, false)
							console.log(birthday.이름, solar, false)
							let solarMonth = solar.month < 10 ? "0" + solar.month : solar.month.toString()
							let solarDay = solar.day < 10 ? "0" + solar.day : solar.day.toString()
							birthdays.push({
								내용 : `${birthday.이름} 음력 ${month}월 ${day}일 생일`,
								생일 : `${solar.year}-${solarMonth}-${solarDay}`,
								음력여부 : true,
							})
						} catch {
							console.log()
						}
					}
				}
			}
		}		
		funcs.sendSuccess(res, birthdays)
	} catch (e) {
		console.log(e)
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

router.post("/test", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		result = []
		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

module.exports = router
