let express = require('express')
let router = express.Router()
let crypto = require("crypto");
let db = require("../exports/oracle")
let funcs = require("../exports/functions");
let salt = require("../exports/config/crypto");

/* GET home page. */

router.post('/', (req, res, next) => {
	const userAgent = req.get('User-Agent')
	console.log(`User-Agent : ${userAgent}`)
	db.connection((succ, conn) => {
		if (succ) {
			try {
				pw = crypto.pbkdf2Sync(req.body.pw, salt, 1, 64, "SHA512").toString("base64")
				console.log(pw)
				const sql = `
					SELECT 아이디, 이름, 관리자여부, 직위코드, 직위
					FROM EMP_POS E
					WHERE 아이디 = :id AND 비밀번호 = :pw`
				const params = { id: req.body.id, pw: pw }
				db.select(conn, sql, params, (succ, rows) => {
					if (!succ) {
						funcs.sendFail(res, "DB 조회 중 에러")
					} else {
						if (rows.length == 0) {
							funcs.sendFail(res, "로그인 정보 없음")
						} else {
							const data = rows[0]
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
					}
					db.close(conn)
				})
			} catch (e) {
				db.close(conn)
				console.error(e)
				funcs.sendFail(res, "DB 조회 중 에러 (catch)")
			}
		} else {
			funcs.sendFail(res, "DB 연결 실패")
		}
	})
});

router.post('/update', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				pw = crypto.pbkdf2Sync(req.body.pw, salt, 1, 64, "SHA512").toString("base64")
				const sql = `
					UPDATE EMP SET 비밀번호 = :pw WHERE 아이디 = :id`
				const params = { id: req.body.id, pw: pw }
				db.update(conn, sql, params, (succ, rows) => {
					if (!succ) {
						db.rollback(conn)
						funcs.sendFail(res, "DB 업데이트 중 에러")
					} else {
						db.commit(conn)
						funcs.sendSuccess(res, req.session.user)
					}
					db.close(conn)
				})
			} catch (e) {
				db.close(conn)
				console.error(e)
				funcs.sendFail(res, "DB 조회 중 에러 (catch)")
			}
		} else {
			funcs.sendFail(res, "DB 연결 실패")
		}
	})
});

// router.post('/test', (req, res, next) => {
// 	hash = crypto.pbkdf2Sync(req.body.pw, salt, 1, 64, "SHA512").toString("base64")
// 	funcs.sendSuccess(res)
// });
module.exports = router;
