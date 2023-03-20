let express = require('express');
let router = express.Router()
let db = require("../exports/oracle");
let funcs = require("../exports/functions");
let kakaowork = require("../exports/kakaowork");
let holidayKey = require("../exports/config/holiday")
const axios = require("axios");

/* 공휴일 목록 불러오기 */
router.get('/holiday', (req, res, next) => {
    const id = req.query.id
    // const isAll = JSON.parse(req.query.isAll);
    let url = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo';
    let numOfRows = '100';
    let solYear = '2022';
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
        console.log(response.data.response.body.items.item);
            db.connection((succ, conn) => {
                // let i=1;
                if (succ) {
                        try {
                            const sql =
                                `
                                    MERGE INTO HOLIDAY a
                                    USING DUAL
                                    ON (a.DATENAME = :dateName)
                                    WHEN NOT MATCHED THEN
                                        INSERT (a.DATENAME, a.ISHOLIDAY, a.LOCDATE)
                                        VALUES (:dateName, :isHoliday, to_date(:locdate,'YYYY-MM-DD'))
                                `
                            db.updateBulk(conn, sql,response.data.response.body.items.item , (succ, rows) => {
                            // db.updateBulk(conn, sql,[{
                            //     dateName: '기독탄신일',
                            //     isHoliday: 'Y',
                            //     locdate: 20221225,
                            // }] , (succ, rows) => {
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
