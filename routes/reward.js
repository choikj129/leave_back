let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
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
                AND R.기준연도 = :year
            ORDER BY 등록일
        `
		const result = await db.select(conn, sql, req.query)

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
        console.error(e)
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
                IDX, 아이디, 휴가유형, 휴가일수, 등록일, 만료일, 기준연도
            ) VALUES (
                SEQ_REWARD.NEXTVAL, :id, :type, :cnt, :date, TO_CHAR(ADD_MONTHS(TO_DATE(:date, 'YYYYMMDD'), 12)-1, 'YYYYMMDD'), :year
            )
        `
		const result = await db.update(conn, sql, req.body)
        
        await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
        await db.rollback(conn)
		funcs.sendFail(res, e)
        console.error(e)
	} finally {
		db.close(conn)
	}
})

/* 포상 / 리프레시 휴가 삭제 */
router.delete("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        const sql = `DELETE FROM REWARD WHERE IDX = :idx AND 사용일수 = 0`
		const result = await db.update(conn, sql, req.body)

        await db.commit(conn)
        result == 0 ? funcs.sendFail(res, "이미 사용한 휴가는 삭제할 수 없습니다.") : funcs.sendSuccess(res, result)        
	} catch(e) {
        await db.rollback(conn)
		funcs.sendFail(res, e)
        console.error(e)
	} finally {
		db.close(conn)
	}	
})

router.get("/user", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        const rewardSql = `
            SELECT *
            FROM REWARD
            WHERE
                아이디 = :id
                AND 휴가일수 > 사용일수
                AND 휴가유형 = '포상'
                AND 기준연도 = :year
            ORDER BY 만료일, IDX
        `
        const refreshSql = `
            SELECT *
            FROM REWARD
            WHERE
                아이디 = :id
                AND 휴가일수 > 사용일수
                AND 휴가유형 = '리프레시'
                AND 기준연도 = :year
            ORDER BY 만료일, IDX
        `
		const result = await db.multiSelect(conn, {
            reward : { query : rewardSql, params : req.query },
            refresh : { query : refreshSql, params : req.query },
        })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
        console.error(e)
	} finally {
		db.close(conn)
	}
})

/* 직원별 포상 / 리프레시 휴가 개수 조회 */
router.get("/cnts", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        const rewardSql = `
            SELECT NVL(SUM(휴가일수), 0) 휴가일수, NVL(SUM(사용일수), 0) 사용일수
            FROM REWARD
            WHERE
                아이디 = :id
                AND 기준연도 = :year
                AND 휴가유형 = '포상'
        `
        const refreshSql = `
            SELECT NVL(SUM(휴가일수), 0) 휴가일수, NVL(SUM(사용일수), 0) 사용일수
            FROM REWARD
            WHERE
                아이디 = :id
                AND 기준연도 = :year
                AND 휴가유형 = '리프레시'
        `
		const result = await db.multiSelect(conn, {
            reward : { query : rewardSql, params : req.query },
            refresh : { query : refreshSql, params : req.query },
        })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
        console.error(e)
	} finally {
		db.close(conn)
	}
})
module.exports = router
