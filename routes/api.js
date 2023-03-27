var express = require('express');
var router = express.Router();

const db = require("../exports/oracle");
const funcs = require("../exports/functions");
const dbfuncs = require("../exports/dbfunctions");

//코드에서 키 불러오기
router.get("/code", async (req, res, next) => {
	// TODO: 
	try {
		const {rows} = await dbfuncs.getCode("공공데이터키")
		console.log("result api",rows)
		funcs.sendSuccess(res, rows)
	} catch (e){
		console.log(e)
		funcs.sendFail(res, e)
	} 
});


// 키 이름 수정
router.post('/update', async (req, res, next) => {
	const param = req.body
	// 키 값 없을 시 실행 안함
	if(param.key == undefined || param.key === ""){
		funcs.sendFail(res, "key값 없음")
		return
	}
	const sql = `
                    UPDATE CODE SET
						표시내용 = :key
					WHERE
					코드구분 = :name
                `
	const updParam = {name : "공공데이터키", key:param.key}
	try {
		const {rowsAffected} = await dbfuncs.doQuery(sql, updParam)
		console.log("result update api",rowsAffected)
		funcs.sendSuccess(res, rowsAffected)
	} catch (e){
		console.log(e)
		funcs.sendFail(res, e)
	} 
})

module.exports = router;
