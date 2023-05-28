let express = require("express")
let router = express.Router()
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
                    IDX,
                    이름 || ' ' || 직위 || ' ' || 내용 내용,
                    시작일,
                    종료일,
                    휴가일수                    
                FROM LEAVE L, EMP_POS E
                WHERE L.아이디 = E.아이디
                ORDER BY 내용
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
                FROM LEAVE L, LEAVE_DETAIL LD
                WHERE 아이디 = :id AND L.IDX = LD.LEAVE_IDX
                ORDER BY 내용
            `

		const result = await db.select(conn, sql, { id: id })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
});
/* 휴가 신청 */
router.patch("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        let params = req.body.events
        const id = req.body.id
        const name = req.body.name

        const seqSelect = "SELECT SEQ_LEAVE.NEXTVAL SEQ FROM LEAVE"
        const leaveInsert = `
            INSERT INTO LEAVE
            (IDX, 내용, 시작일, 종료일, 휴가일수, 아이디, REWARD_IDX)
            VALUES
            (:seq, :name, :startDate, :endDate, :cnt, :id, :updateReward)
        `
        const leaveDetailInsert = `
            INSERT INTO LEAVE_DETAIL
            (IDX, LEAVE_IDX, 휴가일, 휴가구분, 기타휴가내용)
            VALUES
            (SEQ_LEAVE_DETAIL.NEXTVAL, :seq, :ymd, :type, :etcType)
        `
        const leaveDelete = `
            DELETE FROM LEAVE WHERE IDX = :idx
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
            INSERT INTO HISTORY (아이디, 내용)
            VALUES (:id, :name)
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
                /* LEAVE INSERT */                
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
                /* LEAVE & LEAVE_DETAIL DELETE */
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
            SELECT NVL(MIN(SUBSTR(휴가일, 0, 4)), TO_CHAR(SYSDATE, 'YYYY')) 휴가시작연도
            FROM LEAVE_DETAIL LD, LEAVE L
            WHERE LD.LEAVE_IDX = L.IDX AND L.아이디 = :id
        `
        : `
            SELECT NVL(MIN(SUBSTR(휴가일, 0, 4)), TO_CHAR(SYSDATE, 'YYYY')) 휴가시작연도
            FROM LEAVE_DETAIL
        `
        const listsSql = `
            SELECT
                LD.IDX,
                LD.휴가일 || ' (' || TO_CHAR(TO_DATE(LD.휴가일, 'YYYY-MM-DD'), 'DY','NLS_DATE_LANGUAGE=KOREAN') || ')' 휴가일,
                LD.휴가구분,
                LD.기타휴가내용 || ' 휴가' 기타휴가내용,
                E.아이디,
                SUBSTR(LD.휴가일, 0, 4) 연도,
                DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '기타', 0, 1) 휴가일수
            FROM LEAVE_DETAIL LD, LEAVE L, EMP E
            WHERE 
                LD.LEAVE_IDX = L.IDX
                AND E.아이디 = L.아이디
                AND E.아이디 = :id 
                AND SUBSTR(LD.휴가일, 0, 4) = :year
            ORDER BY 휴가일
        `
		const result = await db.multiSelect(conn, {
            lists : {query : listsSql, params : {id : req.query.id, year : req.query.year}},
            date : {query : dateSql, params : {id : req.session.user.id}},
        })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
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
            SELECT DISTINCT(A.연도), A.아이디, NVL(LC.휴가수, 0) 휴가수, NVL(사용휴가수, 0) 사용휴가수
            FROM (
                SELECT 연도,아이디 FROM LEAVE_CNT WHERE 아이디 = :id
                UNION ALL
                SELECT SUBSTR(휴가일, 0, 4) 연도, 아이디
                FROM LEAVE L, LEAVE_DETAIL LD
                WHERE 
                    L.IDX = LD.LEAVE_IDX 
                    AND L.아이디 = :id
                GROUP BY SUBSTR(휴가일, 0, 4), 아이디
            ) A
            LEFT JOIN (
                SELECT
                    아이디,
                    SUBSTR(휴가일, 0, 4) 연도,
                    SUM(DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '기타', 0, '포상', 0, '리프레시', 0, 1)) 사용휴가수
                FROM LEAVE L, LEAVE_DETAIL LD
                WHERE 
                    L.IDX = LD.LEAVE_IDX 
                    AND L.아이디 = :id
                GROUP BY SUBSTR(휴가일, 0, 4), 아이디
            ) L ON A.연도 = L.연도
            LEFT JOIN (
                SELECT
                    아이디,
                    연도,
                    휴가수
                FROM LEAVE_CNT
                WHERE 아이디 = :id
            ) LC ON A.연도 = LC.연도
        `
		const result = await db.select(conn, sql, { id: id })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

/* 사이트 접속 (휴가 상세 목록) */
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
	} finally {
		db.close(conn)
	}
})

module.exports = router
