var express = require("express")
var router = express.Router()
let log4j = require("../exports/log4j")
let db = require("../exports/oracle")
let funcs = require("../exports/functions")

/* 사이트 관리자 접속 (직원 정보) */
router.get("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const sql = `
			SELECT
				E.아이디, E.이름, E.직위코드, E.직위, E.입사일, E.관리자여부, E.생일, E.음력여부,
				:year 연도, LC.휴가수, 
				NVL(LD.사용휴가수, 0) 사용휴가수,
				NVL(LD.기타휴가수, 0) 기타휴가수,
				NVL(RF.리프레시휴가수, 0) 리프레시휴가수,
				NVL(RF.사용리프레시휴가수, 0) 사용리프레시휴가수,
				NVL(RR.포상휴가수, 0) 포상휴가수,
				NVL(RR.사용포상휴가수, 0) 사용포상휴가수,
				NVL(RF.리프레시휴가수, 0) + NVL(RR.포상휴가수, 0) 추가휴가수,
				NVL(RR.사용포상휴가수, 0) + NVL(RF.사용리프레시휴가수, 0) 사용추가휴가수,
				TRUNC(MONTHS_BETWEEN(SYSDATE, TO_DATE(입사일, 'YYYYMMDD'))/12) + 1 || '년차' 입사년차
			FROM EMP_POS E
				LEFT JOIN (
					SELECT 아이디, 연도, 휴가수
					FROM LEAVE_CNT
					WHERE 연도 = :year
				) LC ON E.아이디 = LC.아이디
				LEFT JOIN (
					SELECT
						아이디,
						SUBSTR(휴가일, 0, 4) 연도,
						SUM(DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '기타', 0, '포상', 0, '리프레시', 0, 1)) 사용휴가수,
						SUM(DECODE(SUBSTR(휴가구분, 0, 2), '기타', 1, 0)) 기타휴가수
					FROM LEAVE_SUMMARY L, LEAVE_DETAIL LD
					WHERE 
						L.IDX = LD.LEAVE_IDX
						AND SUBSTR(휴가일, 0, 4) = :year
					GROUP BY SUBSTR(휴가일, 0, 4), 아이디
				) LD ON LD.아이디 = E.아이디
				LEFT JOIN (
					SELECT
						아이디,
						SUM(휴가일수) 리프레시휴가수,
						SUM(사용일수) 사용리프레시휴가수
					FROM REWARD
					WHERE
						휴가유형 = '리프레시'
						AND 기준연도 = :year
					GROUP BY 아이디
				) RF ON E.아이디 = RF.아이디
				LEFT JOIN (
					SELECT
						아이디,
						SUM(휴가일수) 포상휴가수,
						SUM(사용일수) 사용포상휴가수
					FROM REWARD
					WHERE
						휴가유형 = '포상'
						AND 기준연도 = :year
					GROUP BY 아이디
				) RR ON E.아이디 = RR.아이디
			WHERE 직위코드 != 'Z'
			ORDER BY 직위코드, 입사일, 이름
		`
		const result = await db.select(conn, sql, {year : req.query.year})

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
});

/* 직원 휴가 수정 */
router.patch("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const updateEmp = `UPDATE EMP SET 직위코드 = :position, 입사일 = :date WHERE 아이디 = :id`
		const updateBirthday = `
			MERGE INTO BIRTHDAY USING DUAL
				ON (아이디 = :id)
			WHEN MATCHED THEN
				UPDATE SET 생일 = :birthday, 음력여부 = :isLunar
			WHEN NOT MATCHED THEN
				INSERT (아이디, 생일, 음력여부)
				VALUES (:id, :birthday, :isLunar)
		`
		const result = await db.multiUpdate(conn, {
			updateEmp : {query : updateEmp, params : req.body},
			updateBirthday : {query : updateBirthday, params : req.body}
		})

		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
});

/* 휴가 신청 기록 */
router.get("/history", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const sql = `
			SELECT A.*
			FROM (
				SELECT H.IDX, E.이름, E.아이디, H.내용, TO_CHAR(H.등록일자, 'YYYY-MM-DD HH24:MI:SS') 등록일자
				FROM HISTORY H, EMP E
				WHERE H.아이디 = E.아이디
				ORDER BY 등록일자 DESC, 내용 DESC
			) A
			WHERE ROWNUM < 31
		`
		const result = await db.select(conn, sql, {})

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})

/* 직원 추가 */
router.put("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const sql = `
			MERGE INTO EMP USING DUAL
				ON (
					아이디 = :id
				)
			WHEN NOT MATCHED THEN
				INSERT (아이디, 이름, 직위코드, 입사일)
				VALUES (:id, :name, :position, :date)
		`
		const result = await db.update(conn, sql, {
			id : req.body.id,
			name : req.body.name,
			position : req.body.position,
			date : req.body.date,
		})

		if (req.body.birthday) {
			req.body.isLunar = req.body.isLunar ? "Y" : "N"
			const birthdaySql = `
				MERGE INTO BIRTHDAY USING DUAL
					ON (아이디 = :id)
				WHEN MATCHED THEN
					UPDATE SET 생일 = :birthday, 음력여부 = :isLunar
				WHEN NOT MATCHED THEN
					INSERT (아이디, 생일, 음력여부)
					VALUES (:id, :birthday, :isLunar)
			`
			await db.update(conn, birthdaySql, req.body)
		}

		await db.commit(conn)
		result == 0 ? funcs.sendFail(res, "중복된 아이디입니다.") : funcs.sendSuccess(res, result)		
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
});

/* 직원 삭제 */
router.delete("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const deleteEmp = `DELETE FROM EMP WHERE 아이디 = :id`
		const deleteBirthday = `DELETE FROM BIRTHDAY WHERE 아이디 = :id`
		const result = await db.multiUpdate(conn, {
			emp : {query : deleteEmp, params : req.body},
			birthday : {query : deleteBirthday, params : req.body},
		})

		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})

/* 경영지원실 직원 변경 */
router.patch("/supporter", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const updateOld = `UPDATE EMP SET 관리자여부 = 'N' WHERE 관리자여부 = 'K'`
		const updateNew = `UPDATE EMP SET 관리자여부 = 'K' WHERE 아이디 = :id`
		const result = await db.multiUpdate(conn, {
			updateOld : {query : updateOld, params : {}},
			updateNew : {query : updateNew, params : req.body},
		})

		await db.commit(conn)
		funcs.sendSuccess(res, result)
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})

/* 엑셀 직원 추가 */
router.post("/insertExcelUsers", async (req, res, next) => {
	let conn
	try {
		const requestUsersSize = req.body.length
		conn = await db.connection();
		const insertUserBulk = 'MERGE INTO EMP '
							 + 'USING DUAL ON (아이디 = :아이디)'
							 + 'WHEN NOT MATCHED THEN '
							 + 'INSERT (아이디, 이름, 직위코드, 입사일) VALUES (:아이디, :이름, :직위코드, :입사일)'

		const insertBirthDayBulk = 'MERGE INTO BIRTHDAY '
								 + 'USING DUAL ON (아이디 = :아이디) '
								 + 'WHEN NOT MATCHED THEN '
								 + 'INSERT (아이디, 생일, 음력여부) VALUES (:아이디, :생일, :음력여부)'

		const insertLeaveCntBulk = 'MERGE INTO LEAVE_CNT '
								 + 'USING DUAL ON (아이디 = :아이디) '
								 + 'WHEN NOT MATCHED THEN '
								 + 'INSERT (아이디, 연도, 휴가수) VALUES (:아이디, :연도, :휴가수)'

		const result = await db.multiUpdateBulk(conn, {
			insertUsers : {query : insertUserBulk, params: req.body}, 
			insertBirthday : {query : insertBirthDayBulk, params: req.body}, 
			insertLeaveCnt : {query : insertLeaveCntBulk, params: req.body}, 
		})

		const acceptUsersSize = result.insertUsers

		await db.commit(conn);

		if (acceptUsersSize != requestUsersSize) {
			funcs.sendFail(res, `\n입력 직원 수 = ${requestUsersSize}\nDB 인입 성공 건수 = ${acceptUsersSize}\n사유 : 중복아이디 혹은 기타 알 수 없는 이유`)
			return
		}

		funcs.sendSuccess(res, result);
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
		log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
});

module.exports = router
