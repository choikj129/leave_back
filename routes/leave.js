let express = require('express');
let router = express.Router()
let db = require("../exports/oracle");
let funcs = require("../exports/functions");
let kakaowork = require("../exports/kakaowork");
const { DB_TYPE_VARCHAR } = require('oracledb');


/* GET home page. */
router.get('/', (req, res, next) => {
    const id = req.query.id
    db.connection((conn) => {
        if (conn) {
            try {
                const sql = "SELECT IDX, 내용, 시작일, 종료일, 휴가일수 FROM LEAVE WHERE 아이디=:id ORDER BY 내용"
                db.select(sql, { id: id }, (succ, rows) => {
                    if (succ) {
                        funcs.sendSuccess(res, rows)                        
                    } else {
                        funcs.sendFail(res, "DB 조회 중 에러")
                    }
                    db.close()
                })
            } catch {
                funcs.sendFail(res, "DB 조회 중 에러 (catch)")
                db.close()
            }
        } else {
            funcs.sendFail(res, "DB 연결 실패")
        }
    })
});

router.post('/', (req, res, next) => {
    db.connection((conn) => {
        if (conn) {
            try {
                let params = req.body.events
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
                db.select(seqSelect, {}, (succ, rows) => {
                    let kakaoWorkArr = []

                    let leaveInsertArr = []
                    let leaveDeleteArr = []
                    let leaveDetailInsertArr = []
                    if (!succ) {
                        funcs.sendFail(res, "DB 조회 중 에러")
                    } else {
                        let dbHash = {}
                        let seq = rows[0].SEQ
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
                                    id: req.session.user.id,
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
                        db.multiUpdateBulk(dbHash, (succ, result) => {
                            console.log(succ, result)
                            if (succ) {
                                if (req.session.user.isManager) {
                                    funcs.sendSuccess(res, [], "휴가 등록 / 취소 완료")
                                    db.commit()
                                    db.close()
                                } else {
                                    kakaowork.sendMessage(kakaoWorkArr.sort(), req.session.user, (isSend) => {
                                        if (isSend) {
                                            funcs.sendSuccess(res, [], "카카오워크 전송 성공")
                                            db.commit()
                                        } else {                                                            
                                            funcs.sendFail(res, "카카오워크 전송 실패")
                                            db.rollback()
                                        }
                                        db.close()
                                    })
                                }
                            } else {
                                funcs.sendFail(res, "휴가 등록 / 취소 실패")
                                db.close()
                            }
                        })
                    }
                })
            } catch (e) {
                db.rollback()
                db.close()
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
    db.connection((conn) => {
        if (conn) {
            try {
                const sql = `
                    SELECT LD.*, L.아이디, 연도, LC.연차수, LC.포상휴가수, LC.연차수+LC.포상휴가수 총휴가수
                    FROM LEAVE_DETAIL LD, LEAVE L, LEAVE_CNT LC
                    WHERE 
                        LD.LEAVE_IDX = L.IDX 
                        AND L.아이디=:id  
                        AND L.아이디 = LC.아이디 
                        AND SUBSTR(LD.휴가일, 0, 4) = LC.연도 
                    ORDER BY 연도 DESC, 휴가일
                `
                db.select(sql, { id: id }, (succ, rows) => {
                    if (succ) {
                        funcs.sendSuccess(res, rows)                        
                    } else {
                        funcs.sendFail(res, "DB 조회 중 에러")
                    }
                    db.close()
                })
            } catch {
                funcs.sendFail(res, "DB 조회 중 에러 (catch)")
                db.close()
            }
        } else {
            funcs.sendFail(res, "DB 연결 실패")
        }
    })
});

module.exports = router;
