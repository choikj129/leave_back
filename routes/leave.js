let express = require('express');
const { SUBSCR_QOS_RELIABLE } = require('oracledb');
let router = express.Router()
let db = require("../config/oracle");
let session = require("../config/session")

/* GET home page. */
router.get('/', session.interceptor, function(req, res, next) {
  res.render("index", {title:"Express"})
});

router.post('/', session.interceptor, function(req, res, next) {
  let params = req.body.events
  // console.log(params)    
  const seqSelect = "SELECT SEQ_LEAVE.NEXTVAL SEQ FROM DUAL"
  const leaveInsert = `
    INSERT INTO LEAVE 
    (내용, 시작일, 종료일, 휴가일수, 아이디)
    VALUES 
    (:name, :startDate, :endDate, :cnt, :id)
  `
  
  for (i=0; i<params.length; i++){
    let param = params[i]
    db.select(seqSelect, {}, function(result){
      const seq = result[0].SEQ
      param.seq = seq
      param.id = req.session.user.id
      console.log(param)

      // if (!result || result.length == 0) {
        //   res.json({
          //     status : false,
          //     msg : "유효하지 않은 로그인 정보입니다."
          //   });
          // } else {
            //   res.json({
              //     status : true,
              //     data : result
              //   })
      // }
      res.json({
        status : true,
        data : []    
      })
    })  
  }
});
  
  module.exports = router;
  