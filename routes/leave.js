let express = require('express');
let router = express.Router()
let db = require("../exports/oracle");
let kakaowork = require("../exports/kakaowork");

/* GET home page. */
router.get('/', (req, res, next) => {
  res.render("index", {title:"Express"})
});

router.post('/', (req, res, next) => {
  db.connection((conn) => {
    let params = req.body.events
    const seqSelect = "SELECT NVL(MAX(IDX), 0) SEQ FROM LEAVE"
    const leaveInsert = `
      INSERT INTO LEAVE 
      (IDX, 내용, 시작일, 종료일, 휴가일수, 아이디)
      VALUES 
      (:seq, :name, :startDate, :endDate, :cnt, :id)
    `
    const leaveDetailInsert = `
      INSERT INTO LEAVE_DETAIL
      (IDX, LEAVE_IDX, 휴가일, 휴가구분, 기타휴가내용)
      VALUES 
      (SEQ_LEAVE_DETAIL.NEXTVAL, :1, :2, :3, :4)
    `
    if (conn) {
      try {
        db.select(seqSelect, {}, (succ, rows) => {
          let kakaoWorkArr = []
          let leaveArr = []
          let leaveDetailArr = []
          if (!succ) {
            res.json({
              status : false,
              msg : "DB 조회 중 에러",
              data : []    
            })
          } else {
            let seq = rows[0].SEQ
            for (i=0; i<params.length; i++) {
              let param = params[i]              
              seq++
              leaveArr.push({
                seq : seq,
                name : param.name,
                startDate : param.startDate,
                endDate : param.endDate,
                cnt : param.cnt,
                id : req.session.user.id,
              })
              kakaoWorkArr.push(param.name)
              
              let date = new Date(param.startDate)
              for (j=0; j<param.cnt; j++) {
                const year = date.getFullYear()
                const month = date.getMonth()+1 < 10 ? "0" + (date.getMonth()+1) : date.getMonth()+1
                const day = date.getDate() < 10 ? "0" + (date.getDate()) : date.getDate()
                const ymd = `${year}-${month}-${day}`
                leaveDetailArr.push([seq, ymd, param.type, param.etcType])
                date.setDate(date.getDate()+1)
              }
            }

            db.updateBulk(leaveInsert, leaveArr, (leaveSucc, leaveUpCnt) => {
              if (leaveSucc) {
                db.updateBulk(leaveDetailInsert, leaveDetailArr, (leaveDetailSucc, leaveDetailUpCnt) => { 
                  if (leaveDetailSucc) {
                    kakaowork.sendMessage(kakaoWorkArr.sort(), req.session.user, (isSend) => {                      
                      if (isSend) {
                        res.json({
                          status : true,
                          msg : "카카오워크 전송 성공",
                          data : []    
                        })
                        db.commit()                        
                        db.close()
                      } else {
                        console.log("Kakaowork send failed")
                        res.json({
                          status : false,
                          msg : "카카오워크 전송 실패",
                          data : []    
                        })
                        db.rollback()
                        db.close()
                      }
                    })
                  } else {
                    res.json({
                      status : false,
                      msg : "휴가 상세 업데이트 실패",
                      data : []    
                    })
                    db.rollback()
                    db.close()
                  }
                })
              } else {
                db.close()
                res.json({
                  status : false,
                  msg : "휴가 업데이트 실패",
                  data : []    
                })
              }
            })
          }
        })
      } catch(e) {
        db.rollback()
        db.close()
        console.error(e)
        res.json({
          status : false,
          msg : "DB UPDATE 중 에러 (catch)",
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
  