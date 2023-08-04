let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let db = require("../exports/oracle")
let funcs = require("../exports/functions")
let kakaowork = require("../exports/kakaowork")

/* 휴가 일정 페이지 접속 (이벤트 목록) */
router.get("/", async (req, res, next) => {
    const id = req.query.id
    let conn
	try {
		conn = await db.connection()
        const sql = !id
            ? `
                SELECT
                    DISTINCT L.IDX,
                    CONCAT(E.이름, ' ', E.직위, ' ', L.내용) 내용,
                    L.시작일,
                    L.종료일,
                    L.휴가일수,
                    LD.휴가구분,
                    LD.기타휴가내용,
                    L.REWARD_IDX
                FROM LEAVE_SUMMARY L, LEAVE_DETAIL LD, EMP_POS E
                WHERE
                    L.아이디 = E.아이디
                    AND L.IDX = LD.LEAVE_IDX
                    AND 시작일 >= CONCAT(TO_CHAR(ADD_MONTHS(NOW(), -12), 'YYYY'), '-01-01')
                ORDER BY 시작일
            `
            : `
                SELECT 
                    DISTINCT L.IDX,
                    L.내용,
                    L.시작일,
                    L.종료일,
                    L.휴가일수,
                    LD.휴가구분,
                    LD.기타휴가내용,
                    L.REWARD_IDX
                FROM LEAVE_SUMMARY L, LEAVE_DETAIL LD
                WHERE 
                    아이디 = :id 
                    AND L.IDX = LD.LEAVE_IDX
                    AND 시작일 >= CONCAT(TO_CHAR(ADD_MONTHS(NOW(), -12), 'YYYY'), '-01-01')
                ORDER BY 시작일
            `

		const result = await db.select(conn, sql, { id: id })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
        log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})
/* 휴가 신청 */
router.patch("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        let params = req.body.events
        const id = req.body.id
        const name = req.body.name

        const seqSelect = "SELECT NEXTVAL(SEQ_LEAVE) SEQ FROM DUAL"
        const leaveInsert = `
            INSERT INTO LEAVE_SUMMARY
            (IDX, 내용, 시작일, 종료일, 휴가일수, 아이디, REWARD_IDX)
            VALUES
            (:seq, :name, :startDate, :endDate, :cnt, :id, :updateReward)
        `
        const leaveDetailInsert = `
            INSERT INTO LEAVE_DETAIL
            (IDX, LEAVE_IDX, 휴가일, 휴가구분, 기타휴가내용)
            VALUES
            (NEXTVAL(SEQ_LEAVE_DETAIL), :seq, :ymd, :type, :etcType)
        `
        const leaveDelete = `
            DELETE FROM LEAVE_SUMMARY WHERE IDX = :idx
        `
        const leaveDetailDelete = `
            DELETE FROM LEAVE_DETAIL WHERE LEAVE_IDX = :idx
        `
        const rewardUpdate = `
            UPDATE REWARD SET 사용일수 = :사용일수 WHERE IDX = :IDX AND 사용일수 != :사용일수
        `
        const rewardDelete = `
            UPDATE REWARD SET 사용일수 = 사용일수 - :cnt WHERE IDX = :idx
        `
        const historyInsert = `
            INSERT INTO HISTORY (IDX, 아이디, 내용)
            VALUES (NEXTVAL(SEQ_HISTORY), :id, :name)
        `
        let dbHash = {
            leaveInsert : {query : leaveInsert, params : []},
            leaveDetailInsert : {query : leaveDetailInsert, params : []},
            leaveDelete : {query : leaveDelete, params : []},
            leaveDetailDelete : {query : leaveDetailDelete, params : []},
            history : {query : historyInsert, params : []},
            rewardUpdate : {query : rewardUpdate, params : req.body.reward},
            rewardDelete : {query : rewardDelete, params : []},
        }

        let kakaoWorkArr = []
        for (const param of params) {
            const seqResult = await db.select(conn, seqSelect, {})
            const seq = seqResult[0].SEQ
            dbHash.history.params.push({id : id, name : param.name})
            if (param.updateType == "I") {
                /* LEAVE_SUMMARY INSERT */                
                dbHash.leaveInsert.params.push({
                    seq: seq,
                    name: param.name,
                    startDate: param.startDate,
                    endDate: param.endDate,
                    cnt: param.cnt,
                    id: id,
                    updateReward : param.updateReward
                })                                
                /* LEAVE_DETAIL INSERT */
                let date = new Date(param.startDate)
                for (j = 0; j < param.cnt; j++) {
                    const year = date.getFullYear()
                    const month = date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1
                    const day = date.getDate() < 10 ? "0" + (date.getDate()) : date.getDate()
                    const ymd = `${year}-${month}-${day}`
                    dbHash.leaveDetailInsert.params.push({
                        seq : seq,
                        ymd : ymd,
                        type : param.type,
                        etcType : param.etcType,
                    })
                    date.setDate(date.getDate() + 1)
                }
            } else if (param.updateType == "D") {
                /* LEAVE_SUMMARY & LEAVE_DETAIL DELETE */
                dbHash.leaveDelete.params.push({idx : param.IDX})
                dbHash.leaveDetailDelete.params.push({idx : param.IDX})

                if (param.rewardIdx) {
                    let rewardIdx = JSON.parse(param.rewardIdx)
                    for (const key of Object.keys(rewardIdx)) {
                        dbHash.rewardDelete.params.push({
                            idx : key,
                            cnt : rewardIdx[key]
                        })
                    }
                }
            }
            kakaoWorkArr.push(param.name)
        }
        await db.multiUpdateBulk(conn, dbHash)

        const contents = `${name}\n${kakaoWorkArr.sort().join("\n")}`
        const isSend = await kakaowork.sendMessage(contents)
        if (isSend) {
            funcs.sendSuccess(res, [], "카카오워크 전송 성공")
            await db.commit(conn)
        } else {
            funcs.sendFail(res, "카카오워크 전송 실패")
            await db.rollback(conn)
        }
	} catch(e) {
		await db.rollback(conn)
		funcs.sendFail(res, e)
        log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})

/* 휴가 리스트 */
router.get("/lists", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        /* 관리자는 휴가 중 최소 휴가연도, 기본 직원은 본인 신청 최소 휴가연도 */
        const dateSql = !req.query.isManager
        ? `
            SELECT COALESCE(MIN(SUBSTR(휴가일, 1, 4)), DATE_FORMAT(NOW(), '%Y')) 휴가시작연도
            FROM LEAVE_DETAIL LD, LEAVE_SUMMARY L
            WHERE LD.LEAVE_IDX = L.IDX AND L.아이디 = :id
        `
        : `
            SELECT COALESCE(MIN(SUBSTR(휴가일, 1, 4)), DATE_FORMAT(NOW(), '%Y')) 휴가시작연도
            FROM LEAVE_DETAIL
        `
        const listsSql = `
            SELECT
                LD.IDX,
                CONCAT(LD.휴가일, ' (', SUBSTR('일월화수목금토', DAYOFWEEK(휴가일), 1), ')') 휴가일,
                LD.휴가구분,
                CONCAT(LD.기타휴가내용, ' 휴가') 기타휴가내용,
                E.아이디,
                SUBSTRING(LD.휴가일, 1, 4) 연도,
                CASE
                    WHEN SUBSTRING(휴가구분, 1, 2) = '오후' THEN 0.5
                    WHEN SUBSTRING(휴가구분, 1, 2) = '오전' THEN 0.5
                    WHEN SUBSTRING(휴가구분, 1, 2) = '기타' THEN 0
                    ELSE 1
                END 휴가일수
            FROM LEAVE_DETAIL LD, LEAVE_SUMMARY L, EMP E
            WHERE 
                LD.LEAVE_IDX = L.IDX
                AND E.아이디 = L.아이디
                AND E.아이디 = :id 
                AND SUBSTR(LD.휴가일, 1, 4) = :year
            ORDER BY 휴가일
        `
		const result = await db.multiSelect(conn, {
            lists : {query : listsSql, params : {id : req.query.id, year : req.query.year}},
            date : {query : dateSql, params : {id : req.session.user.id}},
        })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
        log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})
/* 사이트 접속 (휴가 상세 목록) */
router.get("/cnts", async (req, res, next) => {
    const id = req.query.id
    let conn
	try {
		conn = await db.connection()
        const sql = `
            SELECT
                DISTINCT A.연도,
                A.아이디,
                IFNULL(LC.휴가수, 0) 휴가수,
                IFNULL(사용휴가수, 0) 사용휴가수
            FROM (
                SELECT 연도, 아이디 FROM LEAVE_CNT WHERE 아이디 = :id
                UNION ALL
                SELECT SUBSTRING(휴가일, 1, 4) 연도, 아이디
                FROM LEAVE_SUMMARY L, LEAVE_DETAIL LD
                WHERE 
                    L.IDX = LD.LEAVE_IDX 
                    AND L.아이디 = :id
                GROUP BY 연도, 아이디
            ) A
            LEFT JOIN (
                SELECT
                    아이디,
                    SUBSTRING(휴가일, 1, 4) 연도,
                    SUM(
                        CASE SUBSTRING(휴가구분, 1, 2)
                            WHEN '오후' THEN 0.5
                            WHEN '오전' THEN 0.5
                            WHEN '기타' THEN 0
                            WHEN '포상' THEN 0
                            WHEN '리프' THEN 0
                            ELSE 1
                        END
                    ) 사용휴가수
                FROM LEAVE_SUMMARY L
                JOIN LEAVE_DETAIL LD ON L.IDX = LD.LEAVE_IDX
                WHERE L.아이디 = :id
                GROUP BY 연도, 아이디
            ) L ON A.연도 = L.연도
            LEFT JOIN (
                SELECT 아이디, 연도, 휴가수
                FROM LEAVE_CNT
                WHERE 아이디 = :id
            ) LC ON A.연도 = LC.연도
        `
		const result = await db.select(conn, sql, { id: id })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
        log4j.log(e, "ERROR")
	} finally {
		db.close(conn)
	}
})

/* 사이트 접속 (휴가 수) */
router.patch("/cnt", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        const sql = `
            UPDATE LEAVE_CNT
            SET 휴가수 = :cnt
            WHERE
                아이디 = :id
                AND 연도 = :year
        `
		const result = await db.select(conn, sql, req.body)

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
