let express = require("express")
let router = express.Router()
let db = require("../exports/oracle")
let funcs = require("../exports/functions")

/* 포상 / 리프레시 휴가 조회 */
router.get("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        const sql = `
            SELECT R.*, E.이름, E.직위
            FROM REWARD R, EMP_POS E
            WHERE
                R.아이디 = E.아이디
                AND E.아이디 = :id
            ORDER BY 등록일 DESC
        `
		const result = await db.select(conn, sql, req.query)

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

/* 포상 / 리프레시 휴가 등록 */
router.put("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        const sql = `
            INSERT INTO REWARD (
                아이디, 휴가유형, 휴가일수, 등록일, 만료일
            ) VALUES (
                :id, :type, :cnt, :date, TO_CHAR(ADD_MONTHS(TO_DATE(:date, 'YYYYMMDD'), 12)-1, 'YYYYMMDD')
            )
        `
		const result = await db.update(conn, sql, {
            id : req.body.id,
            type : req.body.type,
            cnt : req.body.cnt,
            date : req.body.date,
        })
        
        await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
        await db.rollback(conn)
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

/* 포상 / 리프레시 휴가 삭제 */
router.delete("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        const sql = `
            MERGE INTO REWARD R USING DUAL
                ON (
                    R.사용일수 = 0 AND 
                    R.IDX = :idx
                )
            WHEN MATCHED THEN
                UPDATE SET R.휴가일수 = -1 WHERE IDX = :idx
                DELETE WHERE IDX = :idx
        `
		const result = await db.update(conn, sql, req.body)

        await db.commit(conn)
        result == 0 ? funcs.sendFail(res, "이미 사용한 휴가는 삭제할 수 없습니다.") : funcs.sendSuccess(res, result)        
	} catch(e) {
        await db.rollback(conn)
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}	
})

/* 직원별 사용가능 포상 / 리프레시 휴가 조회 */
router.get("/user", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        const rewardSql = `
            SELECT * 
            FROM REWARD 
            WHERE 
                TO_CHAR(SYSDATE, 'YYYYMMDD') BETWEEN 등록일 AND 만료일 
                AND 아이디 = :id
                AND 휴가일수 > 사용일수
                AND 휴가유형 = '포상'
            ORDER BY 등록일, IDX
        `
        const refreshSql = `
            SELECT * 
            FROM REWARD 
            WHERE 
                TO_CHAR(SYSDATE, 'YYYYMMDD') BETWEEN 등록일 AND 만료일 
                AND 아이디 = :id
                AND 휴가일수 > 사용일수
                AND 휴가유형 = '리프레시'
            ORDER BY 등록일, IDX
        `
		const result = await db.multiSelect(conn, {
            reward : { query : rewardSql, params : { id : req.query.id } },
            refresh : { query : refreshSql, params : { id : req.query.id } },
        })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})
module.exports = router
