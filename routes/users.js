var express = require('express');
var router = express.Router();
let crypto = require("crypto");
let db = require("../exports/oracle");
let funcs = require("../exports/functions");
let salt = require("../exports/config/crypto");

/* 사이트 관리자 접속 (직원 정보) */
router.get('/', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const whereId = !req.session.user.isManager ? `AND E.아이디='${req.session.user.id}'` : ""
				const sql = `
					SELECT
						E.아이디, E.이름, C.코드명 직위코드, C.표시내용 직위, E.입사일, 
						@year 연도, LC.휴가수, NVL(LD.사용휴가수, 0) 사용휴가수, 
						TRUNC(MONTHS_BETWEEN(SYSDATE, TO_DATE(입사일, 'YYYYMMDD'))/12) + 1 || '년차'
						입사년차
					FROM EMP E 
						LEFT JOIN (
							SELECT 아이디, 연도, 휴가수
							FROM LEAVE_CNT
							WHERE 연도 = @year
						) LC ON E.아이디 = LC.아이디
						LEFT JOIN (
							SELECT 	
								아이디,
								SUBSTR(휴가일, 0, 4) 연도,	
								SUM(DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '기타', 0, 1)) 사용휴가수			
							FROM LEAVE L, LEAVE_DETAIL LD
							WHERE L.IDX = LD.LEAVE_IDX AND SUBSTR(휴가일, 0, 4) = @year
							GROUP BY SUBSTR(휴가일, 0, 4), 아이디
						) LD ON LD.아이디 = E.아이디,
						( SELECT * FROM CODE WHERE 코드구분 = '직위' ) C
					WHERE 관리자여부 = 'N' AND E.직위코드 = C.코드명 ${whereId}
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
router.post('/update', (req, res, next) => {
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
						UPDATE SET 휴가수 = @cnt
					WHEN NOT MATCHED THEN
						INSERT (아이디, 연도, 휴가수)
						VALUES (@id, @year, @cnt)
				`
				const empSql = `
					UPDATE EMP SET 직위코드 = @position, 입사일 = @date WHERE 아이디 = @id
				`
				db.update(conn, sql, req.body.userInfo, (succ, rows) => {
					if (succ) {
						if (req.body.userInfo.isEmpChange) {
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
						}else {
							funcs.sendSuccess(res, rows)
							db.commit(conn)
							db.close(conn)
						}
					} else {
						funcs.sendFail(res, "DB LEAVE_CNT 업데이트 중 에러")
						db.rollback(conn)
						db.close(conn)
					}
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
router.get('/history', (req, res, next) => {
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
/* 휴가 리스트 */
router.get('/lists', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				/* 관리자는 휴가 중 최소 휴가연도, 기본 직원은 본인 신청 최소 휴가연도 */
				const dateSql = !req.session.user.isManager 
					? `
						SELECT NVL(MIN(SUBSTR(휴가일, 0, 4)), TO_CHAR(SYSDATE, 'YYYY')) 휴가시작연도
						FROM LEAVE_DETAIL LD, LEAVE L
						WHERE LD.LEAVE_IDX = L.IDX AND L.아이디 = @id
					`
					: `
						SELECT NVL(MIN(SUBSTR(휴가일, 0, 4)), TO_CHAR(SYSDATE, 'YYYY')) 휴가시작연도
						FROM LEAVE_DETAIL
					`
				const listsSql = `
					SELECT 
						LD.IDX,
						LD.휴가일 || ' (' || TO_CHAR(TO_DATE(LD.휴가일, 'YYYY-MM-DD'), 'DY','NLS_DATE_LANGUAGE=KOREAN') || ')' 휴가일,
						LD.휴가구분,
						LD.기타휴가내용 || ' 휴가' 기타휴가내용,
						E.아이디,
						SUBSTR(LD.휴가일, 0, 4) 연도,
						DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '기타', 0, 1) 휴가일수
					FROM LEAVE_DETAIL LD, LEAVE L, EMP E 
					WHERE LD.LEAVE_IDX = L.IDX AND E.아이디 = L.아이디 AND E.아이디 = @id AND SUBSTR(LD.휴가일, 0, 4) = @year
					ORDER BY 휴가일
				`
				db.multiSelect(conn, {
					lists : {query : listsSql, params : {id : req.query.id, year : req.query.year}},
					date : {query : dateSql, params : {id : req.session.user.id}},
				}, (succ, rows) => {
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
router.post('/insert', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			pw = crypto.pbkdf2Sync("odinue2014", salt, 1, 64, "SHA512").toString("base64")
			try {
				const sql = `
					INSERT INTO EMP (아이디, 비밀번호, 이름, 직위코드, 입사일)
					VALUES (@id, @pw, @name, @position, @date)
				`
				db.update(conn, sql, {
					id : req.body.id,
					pw : pw,
					name : req.body.name,
					position : req.body.position,
					date : req.body.date,
				}, (succ, rows) => {
					if (succ) {
						funcs.sendSuccess(res, rows)
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
router.get('/delete', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `DELETE FROM EMP WHERE 아이디 = @id`
				db.select(conn, sql, {id : req.query.id}, (succ, rows) => {
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
module.exports = router;
