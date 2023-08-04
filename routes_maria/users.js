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
				E.아이디,
				E.이름,
				E.직위코드,
				E.직위,
				E.입사일,
				E.관리자여부,
				E.생일,
				E.음력여부,
				:year 연도,
				LC.휴가수,
				IFNULL(LD.사용휴가수, 0) 사용휴가수,
				IFNULL(LD.기타휴가수, 0) 기타휴가수,
				IFNULL(RF.리프레시휴가수, 0) 리프레시휴가수,
				IFNULL(RF.사용리프레시휴가수, 0) 사용리프레시휴가수,
				IFNULL(RR.포상휴가수, 0) 포상휴가수,
				IFNULL(RR.사용포상휴가수, 0) 사용포상휴가수,
				IFNULL(RF.리프레시휴가수, 0) + IFNULL(RR.포상휴가수, 0) 추가휴가수,
				IFNULL(RR.사용포상휴가수, 0) + IFNULL(RF.사용리프레시휴가수, 0) 사용추가휴가수,
				CONCAT(TIMESTAMPDIFF(year, '20230103', NOW()) + 1, '년차') 입사년차
			FROM EMP_POS E
			LEFT JOIN (
				SELECT 아이디, 연도, 휴가수
				FROM LEAVE_CNT
				WHERE 연도 = :year
			) LC ON E.아이디 = LC.아이디
			LEFT JOIN (
				SELECT
					아이디,
					SUBSTRING(휴가일, 1, 4) 연도,
					SUM(CASE SUBSTRING(휴가구분, 1, 2)
						WHEN '오후' THEN 0.5
						WHEN '오전' THEN 0.5
						WHEN '기타' THEN 0
						WHEN '포상' THEN 0
						WHEN '리프레시' THEN 0
						ELSE 1
					END) 사용휴가수,
					SUM(CASE SUBSTRING(휴가구분, 1, 2)
						WHEN '기타' THEN 1
						ELSE 0
					END) 기타휴가수
				FROM LEAVE_SUMMARY L
				JOIN LEAVE_DETAIL LD ON L.IDX = LD.LEAVE_IDX
				WHERE SUBSTRING(휴가일, 1, 4) = :year
				GROUP BY SUBSTRING(휴가일, 1, 4), 아이디
			) LD ON LD.아이디 = E.아이디
			LEFT JOIN (
				SELECT
					아이디,
					SUM(휴가일수) 리프레시휴가수,
					SUM(사용일수) 사용리프레시휴가수
				FROM REWARD
				WHERE 휴가유형 = '리프레시' AND 기준연도 = :year
				GROUP BY 아이디
			) RF ON E.아이디 = RF.아이디
			LEFT JOIN (
				SELECT
					아이디,
					SUM(휴가일수) 포상휴가수,
					SUM(사용일수) 사용포상휴가수
				FROM REWARD
				WHERE 휴가유형 = '포상' AND 기준연도 = :year
				GROUP BY 아이디
			) RR ON E.아이디 = RR.아이디
			WHERE E.직위코드 != 'Z'
			ORDER BY E.직위코드, E.입사일, E.이름
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

/* 직원 정보 수정 */
router.patch("/", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const updateEmp = `UPDATE EMP SET 직위코드 = :position, 입사일 = :date WHERE 아이디 = :id`
		const updateBirthday = `
			INSERT INTO BIRTHDAY (아이디, 생일, 음력여부)
			VALUES (:id, :birthday, :isLunar)
			ON DUPLICATE KEY UPDATE 생일 = :birthday, 음력여부 = :isLunar
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
			SELECT H.IDX, E.이름, E.아이디, H.내용, TO_CHAR(H.등록일자, 'YYYY-MM-DD HH24:MI:SS') 등록일자
			FROM HISTORY H, EMP E
			WHERE H.아이디 = E.아이디
			ORDER BY 등록일자 DESC, 내용 desc
			LIMIT 30
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
			INSERT INTO EMP (아이디, 이름, 직위코드, 입사일)
			SELECT :id, :name, :position, :date
			FROM DUAL
			WHERE NOT EXISTS (
				SELECT 1
				FROM EMP
				WHERE 아이디 = :id
			)
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
				INSERT INTO BIRTHDAY (아이디, 생일, 음력여부)
				VALUES (:id, :birthday, :isLunar)
				ON DUPLICATE KEY UPDATE 생일 = :birthday, 음력여부 = :isLunar;
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

module.exports = router
