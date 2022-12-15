let express = require('express')
let router = express.Router()
let db = require("../config/oracle")
let crypto = require("crypto");
const { DB_TYPE_BFILE } = require('oracledb');
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render("index", {title:"Express"})
});

router.post('/',  async function(req, res, next) {
  params = {id : req.body.id, pw : req.body.pw}
  await db.select("SELECT * FROM EMP WHERE 아이디=:id and 비밀번호=:pw", params, function(result){
    if (!result) {
      res.json({
        status : false,
        msg : "유효하지 않은 로그인 정보입니다."
      });
    } else {
      res.json({
        status : true,
        data : result
      })
    }
  })  
});

module.exports = router;
