var express = require('express');
var router = express.Router();

const db = require("../exports/oracle");
const funcs = require("../exports/functions");

//코드에서 키 불러오기
router.get("/code", (req, res, next) => {
	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sort = req.query.reverse != undefined && req.query.reverse ? "DESC" : "ASC"
				const sql = `SELECT 표시내용 KEY FROM CODE WHERE 코드구분 = :name AND 사용여부 = 'Y' ORDER BY 코드명 ${sort}`
				db.select(conn, sql, {name : "공공데이터키"}, (succ, rows) => {
					if (succ) {
						funcs.sendSuccess(res, rows)
					} else {
						funcs.sendFail(res, "DB 조회 중 에러")
					}
				})
			} catch {
				funcs.sendFail(res, "DB 조회 중 에러 (catch)")
			} finally {
				db.close(conn)
			}
		} else {
			funcs.sendFail(res, "DB 연결 실패")
		}
	})
});


// 키 이름 수정
router.post('/update', (req, res, next) => {
	const param = req.body
	// 키 값 없을 시 실행 안함
	if(param.key == undefined || param.key === ""){
		funcs.sendFail(res, "key값 없음")
		return
	}

	db.connection((succ, conn) => {
		if (succ) {
			try {
				const sql = `
                    UPDATE CODE SET
						표시내용 = :key
					WHERE
					코드구분 = :name
                `
				db.update(conn, sql, {name : "공공데이터키", key:param.key}, (succ, rows) =>{
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

module.exports = router;
