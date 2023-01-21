let express = require('express')
let router = express.Router()
let db = require("../exports/oracle")
let funcs = require("../exports/functions");
// let crypto = require("crypto");

/* GET home page. */

router.post('/', (req, res, next) => {
  db.connection((conn) => {
    if (conn) {
      try {
        const sql = "SELECT * FROM EMP WHERE 아이디=:id and 비밀번호=:pw"
        const params = {id : req.body.id, pw : req.body.pw}
        db.select(sql, params, (succ, rows) =>{
          if (!succ) {
            funcs.sendFail(res, "DB 조회 중 에러")
          } else {
            if (rows.length == 0) {
              funcs.sendFail(res, "로그인 정보 없음")
            } else {
              const data = rows[0]
              req.session.user = {
                id : data.아이디,
                name : data.이름,
                isManager : data.관리자여부 == "Y" ? true : false,
                isLogin : true,                
              }
              funcs.sendSuccess(res, req.session.user)
            }
          }        
          db.close()
        })
      } catch(e) {
        db.close()
        console.error(e)
        funcs.sendFail("DB 조회 중 에러 (catch)")
      }
    } else {
      funcs.sendFail("DB 연결 실패")
    }
  })
});

module.exports = router;
