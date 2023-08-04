let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let db = require("../exports/oracle")
let kakaowork = require("../exports/kakaowork")
let funcs = require("../exports/functions")

const updatePWSql = "UPDATE EMP SET 비밀번호 = :pw WHERE 아이디 = :id"

router.post("/", async (req, res, next) => {	
	let conn
	const userAgent = req.get('User-Agent')
	try {
		conn = await db.connection()
		const pw = funcs.encrypt(req.body.pw)		
		const sql = `
			SELECT 아이디, 이름, 관리자여부, 직위코드, 직위
			FROM EMP_POS E
			WHERE 아이디 = :id AND 비밀번호 = :pw
		`
		const params = { id: req.body.id, pw: pw }
		const result = await db.select(conn, sql, params)
		if (result.length == 0) {
			funcs.sendFail(res, "로그인 정보 없음")
		} else {
			const data = result[0]
			req.session.user = {
				id: data.아이디,
				name: data.이름,
				position: data.직위,
				isManager : data.관리자여부 == "Y" ? true : false,
				isLogin : true,
				isMobile : /mobile/i.test(userAgent),
			}

			funcs.sendSuccess(res, req.session.user)
		}
		log4j.log(`(${req.body.id}) - User-Agent : ${userAgent}`, "INFO")
	} catch (e) {
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})

/* 비밀번호 변경 */
router.patch("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const pw = funcs.encrypt(req.body.pw)		
		const params = { id: req.body.id, pw: pw }
		const result = await db.update(conn, updatePWSql, params)

		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})

/* 비밀번호 초기화 */
router.patch("/reset", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()

		const sql = `
			SELECT CONCAT(:id, '@', 표시내용) 이메일
			FROM EMP, (SELECT 표시내용 FROM CODE WHERE 사용여부 = 'Y' AND 코드구분 = '이메일' AND 코드명 = 0) C
			WHERE 
				아이디 = :id
				AND 이름 = :name
		`
		let params = { id : req.body.id, name : req.body.name }
		const result = await db.select(conn, sql, params)
		
		if (result.length == 0) {
			funcs.sendFail(res, "사용자가 존재하지 않습니다.")
			return
		}
		const email = result[0].이메일
		const userId = await kakaowork.getUserId(email)
		if (!userId) {
			funcs.sendFail(res, `카카오워크 이메일(${email})을 찾을 수 없습니다.`)
			return
		}
		const convId = await kakaowork.conversationOpen(userId)
		if (!convId) {
			funcs.sendFail(res, "카카오워크를 전송 오류.")
			return
		}
		
		const key = funcs.randomChar()
		const pw = funcs.encrypt(key)
		params.pw = pw
		await db.update(conn, updatePWSql, params)

		await kakaowork.sendMessage(`휴가웹 임시 비밀번호\n${key}`, convId)
		
		await db.commit(conn)
		funcs.sendSuccess(res, [], "임시 비밀번호를 카카오워크로 전송했습니다.")
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})

module.exports = router
