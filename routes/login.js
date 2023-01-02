let express = require('express')
let router = express.Router()
let db = require("../config/oracle")
let session = require("../config/session")
// let crypto = require("crypto");

/* GET home page. */
router.get('/', session.interceptor, function(req, res, next) {
  res.render("index", {title:"Express"})
});

router.post('/', session.interceptor, function(req, res, next) {
  const params = {id : req.body.id, pw : req.body.pw}
  const sql = "SELECT * FROM EMP WHERE 아이디=:id and 비밀번호=:pw"
  db.select(sql, params, function(result){    
    if (!result || result.length == 0) {
      res.json({
        status : false,
        msg : "유효하지 않은 로그인 정보입니다."
      });
    } else {      
      const data = result[0]      
      req.session.user = {
        id : data.아이디,
        name : data.이름,
        manager : data.관리자여부,
      }
      res.json({
        status : true,
        data : result
      })
    }
  })  
});

module.exports = router;
