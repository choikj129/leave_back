let express = require('express')
let router = express.Router()
let db = require("../exports/oracle")
// let crypto = require("crypto");

/* GET home page. */
router.get('/', (req, res, next) => {
  res.render("index", {title:"Express"})
});

router.post('/', (req, res, next) => {
  
  db.connection((conn) => {
    if (conn) {
      try {
        const sql = "SELECT * FROM EMP WHERE 아이디=:id and 비밀번호=:pw"
        const params = {id : req.body.id, pw : req.body.pw}

        db.select(sql, params, (succ, rows) =>{
          if (!succ) {
            res.json({
              status : false,
              msg : "DB 조회 중 에러",
              data : []
            });
          } else {
            if (rows.length == 0) {
              res.json({
                status : true,
                msg : "",
                data : []
              })
            } else {
              const data = rows[0]
              req.session.user = {
                id : data.아이디,
                name : data.이름,
                manager : data.관리자여부,
              }              
              res.json({
                status : true,
                msg : "",
                data : data
              })
            }
          }        
          db.close()
        })
      } catch(e) {
        db.close()
        console.error(e)
        res.json({
          status : false,
          msg : "DB 조회 중 에러 (catch)",
          data : []
        })
      }
    } else {
      res.json({
        status : false,
        msg : "DB 연결 실패",
        data : []
      });
    }
  })
});

module.exports = router;
