var express = require('express');
var router = express.Router();
let db = require("../exports/oracle");
let funcs = require("../exports/functions");

/* GET users listing. */
router.get('/', (req, res, next) => {	
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
					SELECT E.아이디, 이름, 연도, 연차수, NVL(포상휴가수, 0) 포상휴가수
					FROM EMP E LEFT JOIN (
							SELECT 아이디, 연도, 연차수, 포상휴가수
							FROM LEAVE_CNT
							WHERE 연도 = TO_CHAR(SYSDATE, 'YYYY')
						) LC ON E.아이디 = LC.아이디
					WHERE 관리자여부 = 'N'
					ORDER BY 이름
				`
				db.select(conn, sql, {}, (succ, rows) => {
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

router.post('/', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
					MERGE INTO LEAVE_CNT USING DUAL
						ON (
							연도 = @year
							AND 아이디 = @id
						)
					WHEN MATCHED THEN
						UPDATE SET 연차수 = @annual, 포상휴가수 = @reward
					WHEN NOT MATCHED THEN
						INSERT (아이디, 연도, 연차수, 포상휴가수)
						VALUES (@id, @year, @annual, @reward)
				`
				db.update(conn, sql, req.body.userInfo, (succ, rows) => {
					if (succ) {
						funcs.sendSuccess(res, rows)
						db.commit(conn)
					} else {
						funcs.sendFail(res, "DB 업데이트 중 에러")
						db.rollback(conn)
					}
					db.close(conn)
				})
			} catch {
				funcs.sendFail(res, "DB 업데이트 중 에러 (catch)")
				db.rollback(conn)
				db.close(conn)
			}
		} else {
			funcs.sendFail(res, "DB 연결 실패")
		}
	})
});
module.exports = router;
