let express = require('express');
let router = express.Router()
let db = require("../exports/oracle");
let funcs = require("../exports/functions");
let holidayKey = require("../exports/config/apiKey").holiday
let today = new Date();
const axios = require("axios");

/* 공휴일 목록 불러오기 */
router.get('/holiday', (req, res, next) => {
    const thisYear = req.query.year
    let url = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo';
    let numOfRows = '100';
    let solYear = thisYear == null ? today.getFullYear() : thisYear ;
    let _type = 'json';
    axios.get(url,{
        headers :{
            'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': '*/*'}
        ,params:{
            numOfRows : numOfRows
            ,solYear : solYear
            ,ServiceKey : holidayKey
            ,_type : _type
        }
    }).then(function(response){
            db.connection((succ, conn) => {
                // let i=1;
                if (succ) {
                        try {
                            const sql =
                                `
                                    MERGE INTO HOLIDAY a
                                    USING DUAL
                                        ON (a.날짜 = to_date(:locdate,'YYYY-MM-DD'))
                                    WHEN NOT MATCHED THEN
                                        INSERT (a.명칭, a.휴일여부, a.날짜, a.수정일자)
                                        VALUES (:dateName, :isHoliday, to_date(:locdate,'YYYY-MM-DD'),sysdate)
                                `
                            db.updateBulk(conn, sql,response.data.response.body.items.item , (succ, rows) => {
                                if (succ) {
                                    funcs.sendSuccess(res, rows)
                                    db.commit(conn)
                                } else {
                                    funcs.sendFail(res, "DB 업데이트 중 에러")
                                    db.rollback(conn)
                                }
                                db.close(conn)
                            })
                        }
                        catch {
                            funcs.sendFail(res, "DB 업데이트 중 에러 에러 (catch)")
                            db.rollback(conn)
                            db.close(conn)
                        }
                }
                else {
                    funcs.sendFail(res, "DB 연결 실패")
                    db.rollback(conn)
                    db.close(conn)
                }
            })
    }).catch(function (error) {
        console.log(error);
    })
});

module.exports = router;
