let express = require('express');
let router = express.Router()
let db = require("../exports/oracle");
let funcs = require("../exports/functions");
let kakaowork = require("../exports/kakaowork");

/* GET home page. */
router.get('/', (req, res, next) => {
    const id = req.query.id
    db.connection((succ, conn) => {
        if (succ) {
            try {
                let where = req.session.user.isManager ? "" : "WHERE 아이디=@id"
                const sql = `SELECT IDX, 내용, 시작일, 종료일, 휴가일수 FROM LEAVE ${where} ORDER BY 내용`
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

router.post('/', (req, res, next) => {
    db.connection((succ, conn) => {
        if (succ) {
            try {
                let params = req.body.events
                const id = req.body.id
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
                db.select(conn, seqSelect, {}, (succ, rows) => {
                    if (!succ) {
                        funcs.sendFail(res, "DB 조회 중 에러")
                    } else {
                        let dbHash = {}
                        let seq = rows[0].SEQ
                        let kakaoWorkArr = []
                        for (i = 0; i < params.length; i++) {
                            let param = params[i]
                            seq++
                            if (param.updateType == "I") {
                                dbHash.leaveInsert = dbHash.leaveInsert == undefined 
                                    ? {query : leaveInsert, params : []}
                                    : dbHash.leaveInsert
                                dbHash.leaveDetailInsert = dbHash.leaveDetailInsert == undefined 
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
                                dbHash.leaveDelete = dbHash.leaveDelete == undefined 
                                    ? {query : leaveDelete, params : []}
                                    : dbHash.leaveDelete
                                dbHash.leaveDetailDelete = dbHash.leaveDetailDelete == undefined 
                                    ? {query : leaveDetailDelete, params : []}
                                    : dbHash.leaveDetailDelete
                                dbHash.leaveDelete.params.push([param.IDX])
                                dbHash.leaveDetailDelete.params.push([param.IDX])
                                param.name += " 취소"
                            }
                            kakaoWorkArr.push(param.name)

                        }
                        db.multiUpdateBulk(conn, dbHash, (succ, result) => {
                            if (succ) {
                                if (req.session.user.isManager) {
                                    funcs.sendSuccess(res, [], "휴가 등록 / 취소 완료")
                                    db.commit(conn)
                                    db.close(conn)
                                } else {
                                    kakaowork.sendMessage(kakaoWorkArr.sort(), req.session.user, (isSend) => {
                                        if (isSend) {
                                            funcs.sendSuccess(res, [], "카카오워크 전송 성공")
                                            db.commit(conn)
                                        } else {                                                            
                                            funcs.sendFail(res, "카카오워크 전송 실패")
                                            db.rollback(conn)
                                        }
                                        db.close(conn)
                                    })
                                }
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

router.get('/lists', (req, res, next) => {
    const id = req.query.id
    db.connection((succ, conn) => {
        if (succ) {
            try {
                const listsSql = `
                    SELECT LD.*, L.아이디, SUBSTR(LD.휴가일, 0, 4) 연도 
                    FROM LEAVE_DETAIL LD, LEAVE L 
                    WHERE LD.LEAVE_IDX = L.IDX AND 아이디=@id 
                    ORDER BY 연도 DESC, 휴가일
                `
                const cntsSql = `
                    SELECT A.연도, A.아이디, NVL(LC.연차수, 0) 연차수, NVL(LC.포상휴가수,0) 포상휴가수, NVL(사용연차수, 0) 사용연차수, NVL(사용포상휴가수, 0) 사용포상휴가수
                    FROM (
                        SELECT 연도,아이디 FROM LEAVE_CNT WHERE 아이디=@id
                        UNION ALL
                        SELECT SUBSTR(휴가일, 0, 4) 연도, 아이디
                        FROM LEAVE L, LEAVE_DETAIL LD
                        WHERE L.IDX = LD.LEAVE_IDX AND L.아이디 = @id
                        GROUP BY SUBSTR(휴가일, 0, 4), 아이디
                    ) A 
                    LEFT JOIN (
                        SELECT
                            아이디,
                            SUBSTR(휴가일, 0, 4) 연도,	
                            SUM(DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '포상', 0, '기타', 0, 1)) 사용연차수, 
                            SUM(DECODE(SUBSTR(휴가구분, 0, 2), '포상', 1, 0)) 사용포상휴가수
                        FROM LEAVE L, LEAVE_DETAIL LD
                        WHERE L.IDX = LD.LEAVE_IDX AND L.아이디 = @id
                        GROUP BY SUBSTR(휴가일, 0, 4), 아이디
                    ) L ON A.연도 = L.연도
                    LEFT JOIN (
                        SELECT 
                            아이디,
                            연도,    	
                            연차수, 
                            포상휴가수
                        FROM LEAVE_CNT
                        WHERE 아이디=@id
                    ) LC ON A.연도 = LC.연도
                `
                let dbHash = {
                    lists : {query : listsSql, params : { id: id }},
                    cnts : {query : cntsSql, params : { id: id }},
                }

                db.multiSelect(conn, dbHash, (succ, rows) => {
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
