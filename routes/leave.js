let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let funcs = require("../exports/functions")
let kakaowork = require("../exports/kakaowork")

// ${process.db}로 동적으로 하려 했지만 Ctrl 추적이 안돼서 기본 값은 그냥 하드코딩 함
let db = require("../exports/oracle")
let leaveSql = require("../oracle/sql_leave")
let rewardSql = require("../oracle/sql_reward")
if ((process.db || "oracle") != "oracle") {
	db = require(`../exports/${process.db}`)
	leaveSql = require(`../${process.db}/sql_leave`)
	rewardSql = require(`../${process.db}/sql_reward`)
}

/**
 * @swagger
 * /leave:
 *   get:
 *     summary: 휴가 조회
 *     tags: [Leave]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *           example: test
 *         required: false
 *         description: id 미 입력 시 전체 직원 휴가 조회
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   IDX:
 *                     type: int
 *                     example: 1
 *                     description: 시퀀스
 *                   내용:
 *                     type: string
 *                     example: 2025-01-09 (목) ~ 2025-01-10 (금) 예비군 휴가
 *                   시작일:
 *                     type: string
 *                     example: 20250109
 *                   종료일:
 *                     type: string
 *                     example: 20250110
 *                   휴가일수:
 *                     type: int
 *                     example: 2
 *                   기타휴가내용:
 *                     type: string
 *                     example: 예비군
 *                     description: 기타 휴가 선택 시 입력한 내용                  
 *                   REWARD_IDX:
 *                     type: string
 *                     example: '{"93":2}'
 *                     description: 포상/리프레시 등록 시 사용된 REWARD.IDX
 *                   휴가순위:
 *                     type: string
 *                     example: 1
 *                     description: 정렬을 위해 공통코드에 정의된 순위
 */
router.get("/", async (req, res, next) => {
    const id = req.query.id
    let conn
	try {
		conn = await db.connection()
		const result = await db.select(conn, leaveSql.selectLeaveInfo(id), { id: id })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
        console.error(e)
	} finally {
		db.close(conn)
	}
})

/**
 * @swagger
 * /leave:
 *   patch:
 *     summary: 휴가 등록, 취소
 *     tags: [Leave]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               events:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     IDX:
 *                       type: int
 *                       example: 
 *                       description: 취소할 휴가의 IDX
 *                     name:
 *                       type: string
 *                       example: 2025-02-10 (월) ~ 2025-02-12 (수) 휴가
 *                       description: 휴가 내용
 *                     startDate:
 *                       type: string
 *                       example: 2025-02-10
 *                       description: 휴가 시작일
 *                     endDate:
 *                       type: string
 *                       example: 2025-02-12
 *                       description: 휴가 종료일
 *                     cnt:
 *                       type: int
 *                       example: 3
 *                       description: 휴가 수
 *                     type:
 *                       type: string
 *                       example: 휴가
 *                       description: 휴가, 오전 반차, 오후 반차, 포상 휴가, 리프레시 휴가, 기타 휴가
 *                     etcType:
 *                       type: string
 *                       example: 
 *                       description: 기타 휴가 등록 시 입력한 내용
 *                     updateType:
 *                       type: string
 *                       example: I
 *                       description: 등록 = I, 취소 = D
 *                     updateReward:
 *                       type: string
 *                       example: 
 *                       description: 사용한 포상 휴가 IDX JSON. {\"1070\":3}
 *               reward:
 *                 type: array
 *                 example: []
 *                 description: 포상 휴가 사용 시 입력. (사용일수, IDX)
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 msg:
 *                   type: string
 */
router.patch("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
        let params = req.body.events
        const id = req.session.user.isManager ? req.body.id : req.session.user.id
        const name = req.session.user.isManager ? req.body.name : req.session.user.name

        let dbHash = {
            insertLeave : {query : leaveSql.insertLeave, params : []},
            insertLeaveDetail : {query : leaveSql.insertLeaveDetail, params : []},
            deleteLeave : {query : leaveSql.deleteLeave, params : []},
            deleteLeaveDetail : {query : leaveSql.deleteLeaveDetail, params : []},
            history : {query : leaveSql.insertHistory, params : []},
            updateReward : {query : rewardSql.useReward, params : req.body.reward},
            deleteReward : {query : rewardSql.cancleReward, params : []},
        }

        let kakaoWorkArr = []
        for (const param of params) {
            const seqResult = await db.select(conn, leaveSql.selectSeq, {})
            const seq = seqResult[0].SEQ
            dbHash.history.params.push({id : id, name : param.name})
            if (param.updateType == "I") {
                /* LEAVE_SUMMARY INSERT */                
                dbHash.insertLeave.params.push({
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
                    dbHash.insertLeaveDetail.params.push({
                        seq : seq,
                        ymd : ymd,
                        type : param.type,
                        etcType : param.etcType,
                    })
                    date.setDate(date.getDate() + 1)
                }
            } else if (param.updateType == "D") {
                if (!param.IDX) {
                    funcs.sendFail(res, "휴가 취소 실패. 유효하지 않은 IDX")
                    return
                }
                /* LEAVE_SUMMARY & LEAVE_DETAIL DELETE */
                // swagger로 쐈을 때 밸리데이션
                if (!param.name.endsWith("취소")) param.name += " 취소"
                dbHash.deleteLeave.params.push({idx : param.IDX})
                dbHash.deleteLeaveDetail.params.push({idx : param.IDX})

                if (param.rewardIdx) {
                    let rewardIdx = JSON.parse(param.rewardIdx)
                    for (const key of Object.keys(rewardIdx)) {
                        dbHash.deleteReward.params.push({
                            idx : key,
                            cnt : rewardIdx[key]
                        })
                    }
                }
            }
            kakaoWorkArr.push(param.name)
        }
        await db.multiUpdateBulk(conn, dbHash)

        const contents = `${req.session.user.isManager? "(관리자) " : ""}${name}\n${kakaoWorkArr.sort().join("\n")}`
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
        console.error(e)
	} finally {
		db.close(conn)
	}
})

/* 휴가 리스트 */
router.get("/lists", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
		const result = await db.select(conn, leaveSql.selectUseLeaveInfo, {
            id : req.query.id,
            year : req.query.year
        })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
        console.error(e)
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
		const result = await db.select(conn, leaveSql.selectLeaveCnts, { id: id })

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
        console.error(e)
	} finally {
		db.close(conn)
	}
})

/* 휴가 신청 기록 */
router.get("/history", async (req, res, next) => {
	let conn
	try {
		conn = await db.connection()
		const result = await db.select(conn, leaveSql.selectLeaveHistory, {})

		funcs.sendSuccess(res, result)
	} catch(e) {
		funcs.sendFail(res, e)
		console.error(e)
	} finally {
		db.close(conn)
	}
})

router.patch("/cnt", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
		const result = await db.select(conn, leaveSql.updateLeaveCnt, req.body)

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

router.post("/cntExcel", async (req, res, next) => {
    let conn
    try {        
        const result = {
            successCount : 0,
        }

        let reqUsers = []
        let updateSql = leaveSql.updateLeaveCnt
        if (req.body.isReward) {
            updateSql = rewardSql.updateRewardFromExcel

            req.body.users.forEach(user => {
                if (user.포상휴가수 > 0) {
                    reqUsers.push({
                        아이디 : user.아이디,
                        기준연도 : user.기준연도,
                        휴가유형 : "포상",
                        등록일 : user.포상휴가등록일,
                        만료일 : user.포상휴가만료일,
                        휴가수 : user.포상휴가수
                    })
                }

                if (user.리프레시휴가수 > 0) {
                    reqUsers.push({
                        아이디 : user.아이디,
                        기준연도 : user.기준연도,
                        휴가유형 : "리프레시",
                        등록일 : user.리프레시휴가등록일,
                        만료일 : user.리프레시휴가만료일,
                        휴가수 : user.리프레시휴가수
                    })
                }
            })
        } else reqUsers = req.body.users

        const requestUserLength = reqUsers.length

        conn = await db.connection()
        const successCount = await db.updateBulk(conn, updateSql, reqUsers)
        
        if (successCount != requestUserLength) {
            throw `\n입력 직원 수 = ${requestUserLength}\nDB 적재 건수 = ${successCount}\n사유 : 아이디가 존재하지 않거나 기타 이유를 알 수 없는 사유\nDB 롤백 진행`
        }

        result.successCount = successCount
        
        await db.commit(conn)
        funcs.sendSuccess(res, result)
    } catch (e) {
        await db.rollback(conn)
        funcs.sendFail(res, e)
        console.error(e)
    } finally {
        db.close(conn)
    }
})

router.patch("/carry-over", async (req, res, next) => {
    let conn
    try {
        conn = await db.connection()
        await db.update(conn, leaveSql.carryOverLeave(req.body.isAllCarry), {
            thisYear : req.body.year,
            lastYear : req.body.year - 1,
        })
        
        await db.commit(conn)
        funcs.sendSuccess(res)
    } catch (e) {
        await db.rollback(conn)
        funcs.sendFail(res, e)
        console.error(e)
    } finally {
        db.close(conn)
    }
})

module.exports = router
