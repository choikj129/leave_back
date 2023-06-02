let express = require("express")
let router = express.Router()
let crypto = require("crypto")
let db = require("../exports/oracle")
let funcs = require("../exports/functions")
let salt = require("../exports/config/crypto")


router.post("/", async (req, res, next) => {
	const userAgent = req.get('User-Agent')
	console.log(`User-Agent : ${userAgent}`)
	let conn
	try {
		conn = await db.connection()
		pw = crypto.pbkdf2Sync(req.body.pw, salt, 1, 64, "SHA512").toString("base64")
		const sql = `
			SELECT 아이디, 이름, 관리자코드, 직위코드, 직위
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
				isManager : data.관리자코드 == "Y" ? true : false,
				isLogin : true,
				isMobile : /mobile/i.test(userAgent),
			}

			funcs.sendSuccess(res, req.session.user)
		}
	} catch (e) {
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

/* 비밀번호 변경 */
router.patch("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		pw = crypto.pbkdf2Sync(req.body.pw, salt, 1, 64, "SHA512").toString("base64")
		const sql = `UPDATE EMP SET 비밀번호 = :pw WHERE 아이디 = :id`
		const params = { id: req.body.id, pw: pw }
		const result = await db.update(conn, sql, params)

		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
		await db.rollback(conn)

		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

module.exports = router
