let express = require("express");
let router = express.Router();
let fs = require("fs");
let path = require("path");
let db = require("../exports/oracle");
let funcs = require("../exports/functions");

router.get("/logout", (req, res, next) => {
	req.session.destroy((err) => {
		if (err) {
			console.log(err);
			funcs.sendFail(res, "Logout session destroy Error")
		} else {
			funcs.sendSuccess(res)
		}
	})
});

router.get("/download", (req, res, next) => {
	console.log(`${__dirname}`)
	const filePath = `${__dirname}/../public/files/`
	let fileName = "어다인_휴가관리_사용자_매뉴얼.pdf"
	if (req.session.user.isManager) {
			fileName = "어다인_휴가관리_관리자_매뉴얼.pdf"
		}
	const file = filePath + fileName
		
	res.download(path.resolve(file), fileName, (result, err) => {
		if (err) {
			console.log(err)
		}
	})
});

router.get("/code", (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sort = req.query.reverse != undefined && req.query.reverse ? "DESC" : "ASC"
				const sql = `SELECT 코드명, 표시내용 FROM CODE WHERE 코드구분 = :name AND 사용여부 = 'Y' ORDER BY 코드명 ${sort}`
				db.select(conn, sql, {name : req.query.name}, (succ, rows) => {
					if (succ) {
						funcs.sendSuccess(res, rows)
					} else {
						funcs.sendFail(res, "DB 조회 중 에러")
					}
					db.close(conn)
				})
			} catch {
				funcs.sendFail(res, "DB 조회 중 에러 (catch)")
				db.close(conn)
			}
		} else {
			funcs.sendFail(res, "DB 연결 실패")
		}
	})
});

/* 공휴일 목록 불러오기 */
/* 공휴일 리스트 */
router.get('/holiday', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				/* 관리자는 휴가 중 최소 휴가연도, 기본 직원은 본인 신청 최소 휴가연도 */
				const holdaySelect = `
					SELECT 명칭, 휴일여부, TO_CHAR(날짜,'YYYY') 년,TO_CHAR(날짜,'MM') 월,TO_CHAR(날짜,'DD') 일
					FROM HOLIDAY
					WHERE 휴일여부 = 'Y'
				`;
				db.select(conn,holdaySelect,"", (succ, rows) => {
					if (succ) {
						funcs.sendSuccess(res, rows)
					} else {
						funcs.sendFail(res, "DB 조회 중 에러")
					}
					db.close(conn)
				})
			} catch {
				funcs.sendFail(res, "DB 조회 중 에러 (catch)")
				db.close(conn)
			}
		} else {
			funcs.sendFail(res, "DB 연결 실패")
		}
	})
});

module.exports = router;
