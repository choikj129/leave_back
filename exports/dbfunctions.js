const db = require("../exports/oracle.js")
const funcs = require("../exports/functions")

module.exports = {
	getCode: async (name) => {
		console.log("code name", name)
		const {succ, conn} = await db.connection()
		console.log("successful connection",succ)
		const sql = `SELECT 표시내용 KEY FROM CODE WHERE 코드구분 = :name AND 사용여부 = 'Y' ORDER BY 코드명`;
		if(succ){
			try{
				const obj = await db.select(conn, sql, {name : name})
				return await obj
			} catch (e){
				console.error(e)
				throw new Error("DB 조회 중 에러 (catch)")
			} finally {
				db.close(conn)
			}
		} else {
			throw new Error("DB연결오류")
		}
		
	},
	doQuery :  async (sql, param) => {
		const {succ, conn} = await db.connection()
		if(succ){
			try{
				return await db.execute(conn, sql, param)
			} catch (e){
				console.error(e)
				throw new Error("DB 조회 중 에러 (catch)")
			} finally {
				db.close(conn)
			}
		} else {
			throw new Error("DB연결오류")
		}
	},
	// doQuery가 다함
	/*
	doUpdate :async (sql, param) => {
		const {succ, conn} = await db.connection()
		if(succ){
			try{
				return await db.update(conn, sql, param)
			} catch (e){
				console.error(e)
				throw new Error("DB 조회 중 에러 (catch)")
			} finally {
				db.close(conn)
			}
		} else {
			throw new Error("DB연결오류")
		}
	},*/
}
