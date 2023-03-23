var express = require("express")
var router = express.Router()
let crypto = require("crypto")
let db = require("../exports/oracle")
let funcs = require("../exports/functions")
let salt = require("../exports/config/crypto")

/* 사이트 관리자 접속 (직원 정보) */
router.get("/", (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
					SELECT
						E.아이디, E.이름, E.직위코드, E.직위, E.입사일,
						:year 연도, LC.휴가수, NVL(LD.사용휴가수, 0) 사용휴가수, NVL(LD.기타휴가수, 0) 기타휴가수,
						NVL(RF.리프레시휴가수, 0) 리프레시휴가수, NVL(LD.사용리프레시휴가수, 0) 사용리프레시휴가수,
						NVL(RR.포상휴가수, 0) 포상휴가수, NVL(LD.사용포상휴가수, 0) 사용포상휴가수,
						NVL(RF.리프레시휴가수 + RR.포상휴가수, 0) 추가휴가수, NVL(LD.사용포상휴가수 + LD.사용리프레시휴가수, 0) 사용추가휴가수,
						TRUNC(MONTHS_BETWEEN(SYSDATE, TO_DATE(입사일, 'YYYYMMDD'))/12) + 1 || '년차' 입사년차
					FROM EMP_POS E
						LEFT JOIN (
							SELECT 아이디, 연도, 휴가수
							FROM LEAVE_CNT
							WHERE 연도 = :year
						) LC ON E.아이디 = LC.아이디
						LEFT JOIN (
							SELECT
								아이디,
								SUBSTR(휴가일, 0, 4) 연도,
								SUM(DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '기타', 0, '포상', 0, '리프레시', 0, 1)) 사용휴가수,
								SUM(DECODE(SUBSTR(휴가구분, 0, 2), '포상', 1, 0)) 사용포상휴가수,
								SUM(DECODE(SUBSTR(휴가구분, 0, 2), '리프레시', 1, 0)) 사용리프레시휴가수,
								SUM(DECODE(SUBSTR(휴가구분, 0, 2), '기타', 1, 0)) 기타휴가수
							FROM LEAVE L, LEAVE_DETAIL LD
							WHERE L.IDX = LD.LEAVE_IDX AND SUBSTR(휴가일, 0, 4) = :year
							GROUP BY SUBSTR(휴가일, 0, 4), 아이디
						) LD ON LD.아이디 = E.아이디
						LEFT JOIN (
							SELECT
								아이디, SUM(휴가일수) 리프레시휴가수
							FROM REWARD
							WHERE
								휴가유형 = '리프레시' AND
								(
									등록일 BETWEEN :year||'0101' AND :year||'1231' OR
									(만료일 BETWEEN :year||'0101' AND :year||'1231' AND 휴가일수 > 사용일수)
								)
							GROUP BY 아이디
						) RF ON E.아이디 = RF.아이디
						LEFT JOIN (
							SELECT
								아이디, SUM(휴가일수) 포상휴가수
							FROM REWARD
							WHERE
								휴가유형 = '포상' AND
								(
									등록일 BETWEEN :year||'0101' AND :year||'1231' OR
									(만료일 BETWEEN :year||'0101' AND :year||'1231' AND 휴가일수 > 사용일수)
								)
							GROUP BY 아이디
						) RR ON E.아이디 = RR.아이디
					WHERE 관리자여부 = 'N'
					ORDER BY 직위코드, 입사일, 이름
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

/* 직원 휴가 수정 */
router.patch("/", (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const empSql = `
					UPDATE EMP SET 직위코드 = :position, 입사일 = :date WHERE 아이디 = :id
				`
				db.update(conn, empSql, req.body.userInfo,  (succ, rows) => {
					if (succ) {
						funcs.sendSuccess(res, rows)
						db.commit(conn)
					} else {
						funcs.sendFail(res, "DB EMP 업데이트 중 에러")
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
/* 휴가 신청 기록 */
router.get("/history", (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
					SELECT A.*
					FROM (
						SELECT H.IDX, E.이름, E.아이디, H.내용, TO_CHAR(H.등록일자, 'YYYY-MM-DD HH24:MI:SS') 등록일자
						FROM HISTORY H, EMP E
						WHERE H.아이디 = E.아이디
						ORDER BY 등록일자 DESC, 내용 DESC
					) A
					WHERE ROWNUM < 31
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

/* 직원 추가 */
router.put("/", (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
					MERGE INTO EMP USING DUAL
						ON (
							아이디 = :id
						)
					WHEN NOT MATCHED THEN
						INSERT (아이디, 이름, 직위코드, 입사일)
						VALUES (:id, :name, :position, :date)					
				`
				db.update(conn, sql, {
					id : req.body.id,
					name : req.body.name,
					position : req.body.position,
					date : req.body.date,
				}, (succ, rows) => {
					if (succ) {
						rows == 0 ? funcs.sendFail(res, "중복된 아이디입니다.") : funcs.sendSuccess(res, rows)
						db.commit(conn)
					} else {
						funcs.sendFail(res, "DB EMP 삽입 중 에러")
						db.rollback(conn)
					}
					db.close(conn)
				})
			} catch {
				funcs.sendFail(res, "DB 삽입 중 에러 (catch)")
				db.rollback(conn)
				db.close(conn)
			}
		} else {
			funcs.sendFail(res, "DB 연결 실패")
		}
	})
});

/* 직원 삭제 */
router.delete("/", (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `DELETE FROM EMP WHERE 아이디 = :id`
				db.select(conn, sql, {id : req.body.id}, (succ, rows) => {
					if (succ) {
						funcs.sendSuccess(res, rows)
						db.commit(conn)
					} else {
						funcs.sendFail(res, "DB 삭제 중 에러")
						db.rollback(conn)
					}
					db.close(conn)
				})
			} catch {
				funcs.sendFail(res, "DB 삭제 중 에러 (catch)")
				db.rollback(conn)
				db.close(conn)
			}
		} else {
			funcs.sendFail(res, "DB 연결 실패")
		}
	})
})

module.exports = router
