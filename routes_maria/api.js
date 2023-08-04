let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
const db = require("../exports/oracle")
const funcs = require("../exports/functions")

//코드에서 키 불러오기
router.get("/code", async (req, res, next) => {
	let  conn 
		try {
			conn = await db.connection()
			const sql = `SELECT 표시내용 "KEY" FROM CODE WHERE 코드구분 = '공공데이터키' AND 사용여부 = 'Y' ORDER BY 코드명`
			const rows = await db.select(conn, sql, {})
			funcs.sendSuccess(res, rows)
		} catch (e){
			db.rollback(conn)
			log4j.log(e, "ERROR")
			funcs.sendFail(res, e)
		} finally {
			db.close(conn)
	}
})


// 키 이름 수정
router.patch('/update', async (req, res, next) => {
	const param = req.body
	// 키 값 없을 시 실행 안함
	if(param.key == undefined || param.key === ""){
		funcs.sendFail(res, "key값 없음")
		return
	}
	const sql = `
		UPDATE CODE SET
			표시내용 = :key
		WHERE
		코드구분 = '공공데이터키'
	`
	const updParam = {key:param.key}
	let conn
	try {
		conn = await db.connection()
		const rows = await db.update(conn, sql, updParam)
		await db.commit(conn)
		funcs.sendSuccess(res, rows)
	} catch (e){
		await db.rollback(conn)
		log4j.log(e, "ERROR")
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

module.exports = router
