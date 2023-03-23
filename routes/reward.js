let express = require('express');
let router = express.Router()
let db = require("../exports/oracle");
let funcs = require("../exports/functions");

/* 포상 / 리프레시 휴가 조회 */
router.get('/', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
                    SELECT R.*, E.이름, E.직위
                    FROM REWARD R, EMP_POS E
                    WHERE
                        R.아이디 = E.아이디 AND
                        E.아이디 = :id
                    ORDER BY 등록일 DESC
                `
				db.select(conn, sql, req.query, (succ, rows) =>{
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

/* 포상 / 리프레시 휴가 등록 */
router.post('/insert', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
                    INSERT INTO REWARD (
                        아이디, 휴가유형, 휴가일수, 등록일, 만료일
                    ) VALUES (
                        :id, :type, :cnt, :date, TO_CHAR(ADD_MONTHS(TO_DATE(:date, 'YYYYMMDD'), 12)-1, 'YYYYMMDD')
                    )
                `
				db.update(conn, sql, {
                    id : req.body.id,
                    type : req.body.type,
                    cnt : req.body.cnt,
                    date : req.body.date,
                }, (succ, rows) =>{
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
})

/* 포상 / 리프레시 휴가 삭제 */
router.post('/delete', (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
                    MERGE INTO REWARD R USING DUAL
                        ON (
                            R.사용일수 = 0 AND 
                            R.IDX = :idx
                        )
                    WHEN MATCHED THEN
                        UPDATE SET R.휴가일수 = -1 WHERE IDX = :idx
                        DELETE WHERE IDX = :idx
                `
				db.update(conn, sql, req.body, (succ, rows) =>{
                    if (succ) {
                        if (rows == 0) {
                            funcs.sendFail(res, "이미 사용한 휴가는 삭제할 수 없습니다.")
                        }
                        else {
                            funcs.sendSuccess(res, rows)
                        }
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
})


module.exports = router;
