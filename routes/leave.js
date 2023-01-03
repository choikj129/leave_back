let express = require('express');
let router = express.Router()
let db = require("../exports/oracle");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render("index", {title:"Express"})
});

router.post('/', function(req, res, next) {
  let params = req.body.events
  const seqSelect = "SELECT SEQ_LEAVE.NEXTVAL SEQ FROM DUAL"
  const leaveInsert = `
    INSERT INTO LEAVE 
    (IDX, 내용, 시작일, 종료일, 휴가일수, 아이디)
    VALUES 
    (:seq, :name, :startDate, :endDate, :cnt, :id)
  `
  const leaveDetailInsert = `
    INSERT INTO LEAVE_DETAIL
    (IDX, LEAVE_IDX, 휴가일)
    VALUES 
    (SEQ_LEAVE_DETAIL.NEXTVAL, :1, :2)
  `
  db.connection(function(result, conn) {
    let leaveDetailArr = []
    try {
      for (i=0; i<params.length; i++) {
        let param = params[i]
        conn.execute(seqSelect, {}, function(err, result){
          const seq = result.rows[0].SEQ
          const insertParam = {
            seq : seq,
            name : param.name,
            startDate : param.startDate,
            endDate : param.endDate,
            cnt : param.cnt,
            id : req.session.user.id,
          }
          
          conn.execute(leaveInsert, insertParam, function(err, result) {
            if (!err) {
              let date = new Date(param.startDate)
              for (j=0; j<param.cnt; j++) {
                  const year = date.getFullYear()
                  const month = date.getMonth()+1 < 10 ? "0" + (date.getMonth()+1) : date.getMonth()+1
                  const day = date.getDate() < 10 ? "0" + (date.getDate()) : date.getDate()
                  const ymd = `${year}-${month}-${day}`
                  leaveDetailArr.push([seq, ymd])
                  date.setDate(date.getDate()+1)
                }                 
            } else {
              db.rollback()
            }
            console.log(leaveDetailArr)
          })
        })
      }            
      res.json({
        status : true,
        msg : "",
        data : []    
      })
    } catch(e) {
      conn.rollback()
      conn.close()
      console.error(e)
    } finally {
      conn.rollback()    
      // conn.executeMany(leaveDetailInsert, leaveDetailArr, function(err, result){           
      //   if (err) {
      //     console.error(err)
      //     db.rollback()
      //   } else {
      //     conn.commit()
      //   }
      //   conn.close()
      // }) 
    }

  })
});
  
  module.exports = router;
  