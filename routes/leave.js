let express = require('express');
let router = express.Router()
let db = require("../exports/oracle");
let funcs = require("../exports/functions");
let kakaowork = require("../exports/kakaowork");

/* 휴가 일정 페이지 접속 (이벤트 목록) */
router.get('/', (req, res, next) => {
    const id = req.query.id
    const isAll = JSON.parse(req.query.isAll)
    db.connection((succ, conn) => {
        if (succ) {
            try {
                const sql = isAll
                    ? `
                        SELECT IDX, 이름 || ' ' || 표시내용 || ' ' || 내용 내용, 시작일, 종료일, 휴가일수 
                        FROM LEAVE L, EMP E, ( SELECT * FROM CODE WHERE 코드구분 = '직위' ) C
                        WHERE L.아이디 = E.아이디 AND E.직위코드 = C.코드명 
                        ORDER BY 내용
                    `
                    : `SELECT IDX, 내용, 시작일, 종료일, 휴가일수 FROM LEAVE where 아이디 = :id ORDER BY 내용`

                db.select(conn, sql, { id: id }, (succ, rows) => {
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
/* 휴가 신청 */
router.post('/', (req, res, next) => {
    db.connection((succ, conn) => {
        if (succ) {
            try {
                let params = req.body.events
                const id = req.body.id
                const name = req.body.name
                const seqSelect = "SELECT NVL(MAX(IDX), 0) SEQ FROM LEAVE"
                const leaveInsert = `
                    INSERT INTO LEAVE 
                    (IDX, 내용, 시작일, 종료일, 휴가일수, 아이디)
                    VALUES 
                    (:seq, :name, :startDate, :endDate, :cnt, :id)
                `
                const leaveDelete = `
                    DELETE FROM LEAVE WHERE IDX = :1
                `
                const leaveDetailInsert = `
                    INSERT INTO LEAVE_DETAIL
                    (IDX, LEAVE_IDX, 휴가일, 휴가구분, 기타휴가내용)
                    VALUES 
                    (SEQ_LEAVE_DETAIL.NEXTVAL, :1, :2, :3, :4)
                `
                const leaveDetailDelete = `
                    DELETE FROM LEAVE_DETAIL WHERE LEAVE_IDX = :1
                `
                const logsInsert = `
                    INSERT INTO HISTORY (아이디, 내용)
                    VALUES (:id, :name)
                `
                db.select(conn, seqSelect, {}, (succ, rows) => {
                    if (!succ) {
                        funcs.sendFail(res, "DB 조회 중 에러")
                    } else {
                        let dbHash = {}
                        dbHash.logs = {query : logsInsert, params : []}
                        let seq = rows[0].SEQ
                        let kakaoWorkArr = []
                        for (i = 0; i < params.length; i++) {
                            let param = params[i]
                            dbHash.logs.params.push({id : id, name : param.name})
                            seq++
                            if (param.updateType == "I") {
                                dbHash.leaveInsert = !dbHash.leaveInsert
                                    ? {query : leaveInsert, params : []}
                                    : dbHash.leaveInsert
                                dbHash.leaveDetailInsert = !dbHash.leaveDetailInsert
                                    ? {query : leaveDetailInsert, params : []}
                                    : dbHash.leaveDetailInsert
                                
                                dbHash.leaveInsert.params.push({
                                    seq: seq,
                                    name: param.name,
                                    startDate: param.startDate,
                                    endDate: param.endDate,
                                    cnt: param.cnt,
                                    id: id,
                                })
                                let date = new Date(param.startDate)
                                for (j = 0; j < param.cnt; j++) {
                                    const year = date.getFullYear()
                                    const month = date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1
                                    const day = date.getDate() < 10 ? "0" + (date.getDate()) : date.getDate()
                                    const ymd = `${year}-${month}-${day}`
                                    dbHash.leaveDetailInsert.params.push([seq, ymd, param.type, param.etcType])
                                    date.setDate(date.getDate() + 1)
                                }
                            } else if (param.updateType == "D") {
                                dbHash.leaveDelete = !dbHash.leaveDelete
                                    ? {query : leaveDelete, params : []}
                                    : dbHash.leaveDelete
                                dbHash.leaveDetailDelete = !dbHash.leaveDetailDelete
                                    ? {query : leaveDetailDelete, params : []}
                                    : dbHash.leaveDetailDelete
                                dbHash.leaveDelete.params.push([param.IDX])
                                dbHash.leaveDetailDelete.params.push([param.IDX])
                            }
                            kakaoWorkArr.push(param.name)
                        }
                        db.multiUpdateBulk(conn, dbHash, (succ, result) => {
                            if (succ) {
                                const contents = `${name}\n${kakaoWorkArr.sort().join("\n")}`
                                kakaowork.sendMessage(contents, (isSend) => {
                                    if (isSend) {
                                        funcs.sendSuccess(res, [], "카카오워크 전송 성공")
                                        db.commit(conn)
                                    } else {
                                        funcs.sendFail(res, "카카오워크 전송 실패")
                                        db.rollback(conn)
                                    }
                                    db.close(conn)
                                })
                            } else {
                                funcs.sendFail(res, "휴가 등록 / 취소 실패")
                                db.close(conn)
                            }
                        })
                    }
                })
            } catch (e) {
                db.rollback(conn)
                db.close(conn)
                console.error(e)
                funcs.sendFail(res, "DB UPDATE 중 에러 (catch)")
            }
        } else {
            funcs.sendFail(res, "DB 연결 실패")
        }
    })
});
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
						WHERE LD.LEAVE_IDX = L.IDX AND L.아이디 = :id
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
					WHERE LD.LEAVE_IDX = L.IDX AND E.아이디 = L.아이디 AND E.아이디 = :id AND SUBSTR(LD.휴가일, 0, 4) = :year
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
/* 사이트 접속 (휴가 상세 목록) */
router.get('/cnts', (req, res, next) => {
    const id = req.query.id
    db.connection((succ, conn) => {
        if (succ) {
            try {
                const sql = `
                    SELECT DISTINCT(A.연도), A.아이디, NVL(LC.휴가수, 0) 휴가수, NVL(사용휴가수, 0) 사용휴가수
                    FROM (
                        SELECT 연도,아이디 FROM LEAVE_CNT WHERE 아이디 = :id
                        UNION ALL
                        SELECT SUBSTR(휴가일, 0, 4) 연도, 아이디
                        FROM LEAVE L, LEAVE_DETAIL LD
                        WHERE L.IDX = LD.LEAVE_IDX AND L.아이디 = :id
                        GROUP BY SUBSTR(휴가일, 0, 4), 아이디
                    ) A 
                    LEFT JOIN (
                        SELECT
                            아이디,
                            SUBSTR(휴가일, 0, 4) 연도,	
                            SUM(DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '기타', 0, 1)) 사용휴가수         
                        FROM LEAVE L, LEAVE_DETAIL LD
                        WHERE L.IDX = LD.LEAVE_IDX AND L.아이디 = :id
                        GROUP BY SUBSTR(휴가일, 0, 4), 아이디
                    ) L ON A.연도 = L.연도
                    LEFT JOIN (
                        SELECT 
                            아이디,
                            연도,    	
                            휴가수        
                        FROM LEAVE_CNT
                        WHERE 아이디 = :id
                    ) LC ON A.연도 = LC.연도
                `
                db.select(conn, sql, { id: id }, (succ, rows) =>{
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
