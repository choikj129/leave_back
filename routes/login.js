let express = require('express')
let router = express.Router()
let db = require("../exports/oracle")
// let crypto = require("crypto");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render("index", {title:"Express"})
});

router.post('/', function(req, res, next) {
  const params = {id : req.body.id, pw : req.body.pw}
  const sql = "SELECT * FROM EMP WHERE 아이디=:id and 비밀번호=:pw"

  db.connection(function(result, conn) {
    try {
      conn.execute(sql, params, function(err, result){
        if (err) {
          res.json({
            status : false,
            msg : "유효하지 않은 로그인 정보입니다.",
            data : []
          });
        } else {      
          const data = result.rows[0]
          req.session.user = {
            id : data.아이디,
            name : data.이름,
            manager : data.관리자여부,
          }
          res.json({
            status : true,
            msg : "",
            data : result.rows[0]
          })
          conn.close()
        }        
      })
    } catch(e) {
      db.close()
      console.error(e)
    }
  })
});

module.exports = router;
