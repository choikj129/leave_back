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
					SELECT E.아이디, E.이름, @year 연도, LC.연차수, NVL(LC.포상휴가수, 0) 포상휴가수, NVL(LD.사용연차수, 0) 사용연차수, NVL(LD.사용포상휴가수, 0) 사용포상휴가수
					FROM EMP E 
						LEFT JOIN (
							SELECT 아이디, 연도, 연차수, 포상휴가수
							FROM LEAVE_CNT
							WHERE 연도 = @year
						) LC ON E.아이디 = LC.아이디
						LEFT JOIN (
							SELECT 	
								아이디,
								SUBSTR(휴가일, 0, 4) 연도,	
								SUM(DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '포상', 0, '기타', 0, 1)) 사용연차수, 
								SUM(DECODE(SUBSTR(휴가구분, 0, 2), '포상', 1, 0)) 사용포상휴가수
							FROM LEAVE L, LEAVE_DETAIL LD
							WHERE L.IDX = LD.LEAVE_IDX AND SUBSTR(휴가일, 0, 4) = @year
							GROUP BY SUBSTR(휴가일, 0, 4), 아이디
						) LD ON LD.아이디 = E.아이디
					WHERE 관리자여부 = 'N'
					ORDER BY 이름
				`
				db.select(conn, sql, {year : req.query.year}, (succ, rows) => {
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

router.get('/logs', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
					SELECT L.* 
					FROM (
						SELECT IDX, 이름, L.아이디, 내용, TO_CHAR(등록일자, 'YYYY-MM-DD HH24:MI:SS') 등록일자 
						FROM LEAVE L, EMP E 
						WHERE L.아이디 = E.아이디 
						ORDER BY 등록일자 DESC, 내용 DESC
					) L 
					WHERE ROWNUM < 30
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
})
module.exports = router;
