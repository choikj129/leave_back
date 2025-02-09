let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let funcs = require("../exports/functions")

// ${process.db}로 동적으로 하려 했지만 Ctrl 추적이 안돼서 기본 값은 그냥 하드코딩 함
let db = require("../exports/oracle")
let rewardSql = require("../oracle/sql_reward")
if ((process.db || "oracle") != "oracle") {
	db = require(`../exports/${process.db}`)
	rewardSql = require(`../${process.db}/sql_reward`)
} 

/**
 * @swagger
 * /reward:
 *   get:
 *     summary: 포상 / 리프레시 휴가 조회
 *     tags: [Reward]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *           example: test
 *         required: true
 *         description: 아이디
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *           example: 2025
 *         required: true
 *         description: 기준연도
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       이름:
 *                         type: string
 *                         example: 테스트
 *                       직위:
 *                         type: string
 *                         example: 주임
 *                       IDX:
 *                         type: int
 *                         example: 5
 *                         description: 시퀀스
 *                       아이디:
 *                         type: string
 *                         example: test
 *                       휴가유형:
 *                         type: string
 *                         example: 포상
 *                         description: 포상 or 리프레시
 *                       휴가일수:
 *                         type: int
 *                         example: 5
 *                       등록일:
 *                         type: string
 *                         example: 20250101
 *                         description: yyyymmdd
 *                       만료일:
 *                         type: string
 *                         example: 20270101
 *                         description: yyyymmdd
 *                       사용일수:
 *                         type: int
 *                         example: 0
 *                       기준연도:
 *                         type: string
 *                         example: 2025
 *                         description: 사용 시 기준연도
 *                       ROOT_IDX:
 *                         type: string
 *                         example: 1
 *                         description: 이월된 row의 idx
 */
router.get("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
		const result = await db.select(conn, rewardSql.selectEmpReward, req.query)

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
 * /reward:
 *   put:
 *     summary: 포상 / 리프레시 휴가 등록
 *     tags: [Reward]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: test
 *               type:
 *                 type: string
 *                 example: 포상
 *                 description: 포상 or 리프레시
 *               cnt:
 *                 type: int
 *                 example: 5
 *                 description: 휴가일 수
 *               date:
 *                 type: string
 *                 example: 20250101
 *                 description: 등록일자
 *               expireDate:
 *                 type: string
 *                 example: 20270101
 *                 description: 만료일자
 *               year:
 *                 type: string
 *                 example: 2025
 *                 description: 사용 시 기준연도 (올해 연도로 입력)
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
router.put("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
		const result = await db.update(conn, rewardSql.insertReward, req.body)
        
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

/**
 * @swagger
 * /reward:
 *   patch:
 *     summary: 포상 / 리프레시 휴가 수정
 *     tags: [Reward]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idx:
 *                 type: int
 *                 example: 시퀀스
 *               cnt:
 *                 type: int
 *                 example: 5
 *                 description: 휴가일 수
 *               expireDate:
 *                 type: string
 *                 example: 20270101
 *                 description: 만료일자
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
		const result = await db.update(conn, rewardSql.updateReward, req.body)
        
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

/**
 * @swagger
 * /reward:
 *   delete:
 *     summary: 포상 / 리프레시 휴가 삭제
 *     description: 사용하지 않은 휴가만 삭제 가능
 *     tags: [Reward]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idx:
 *                 type: int
 *                 example: 5
 *                 description: 시퀀스
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
router.delete("/", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
		const result = await db.update(conn, rewardSql.deleteReward, req.body)

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

/**
 * @swagger
 * /reward/user:
 *   get:
 *     summary: 사용할 포상 / 리프레시 휴가 별 조회
 *     tags: [Reward]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *           example: test
 *         required: true
 *         description: 아이디
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *           example: 2025
 *         required: true
 *         description: 올해연도
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
 *                 data:
 *                    type: object
 *                    properties:
 *                      reward:
 *                        type: array
 *                        description: 포상 휴가
 *                        items:
 *                          type: object
 *                          properties:
 *                            IDX:
 *                              type: int
 *                              example: 5
 *                              description: 시퀀스
 *                            아이디:
 *                              type: string
 *                              example: test
 *                            휴가유형:
 *                              type: string
 *                              example: 포상
 *                              description: 포상 or 리프레시
 *                            휴가일수:
 *                              type: int
 *                              example: 5
 *                            등록일:
 *                              type: string
 *                              example: 20250101
 *                              description: yyyymmdd
 *                            만료일:
 *                              type: string
 *                              example: 20270101
 *                              description: yyyymmdd
 *                            사용일수:
 *                              type: int
 *                              example: 0
 *                            기준연도:
 *                              type: string
 *                              example: 2025
 *                              description: 사용 시 기준연도
 *                            ROOT_IDX:
 *                              type: string
 *                              example: 1
 *                              description: 이월된 row의 idx
 *                      refresh:
 *                        type: array
 *                        description: 리프레시 휴가
 *                        items:
 *                          type: object
 *                          properties:
 *                            IDX:
 *                              type: int
 *                              example: 5
 *                              description: 시퀀스
 *                            아이디:
 *                              type: string
 *                              example: test
 *                            휴가유형:
 *                              type: string
 *                              example: 포상
 *                              description: 포상 or 리프레시
 *                            휴가일수:
 *                              type: int
 *                              example: 5
 *                            등록일:
 *                              type: string
 *                              example: 20250101
 *                              description: yyyymmdd
 *                            만료일:
 *                              type: string
 *                              example: 20270101
 *                              description: yyyymmdd
 *                            사용일수:
 *                              type: int
 *                              example: 0
 *                            기준연도:
 *                              type: string
 *                              example: 2025
 *                              description: 사용 시 기준연도
 *                            ROOT_IDX:
 *                              type: string
 *                              example: 1
 *                              description: 이월된 row의 idx
 */
router.get("/user", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
		const result = await db.multiSelect(conn, {
            reward : { query : rewardSql.selectReward("포상"), params : req.query },
            refresh : { query : rewardSql.selectReward("리프레시"), params : req.query },
        })

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
 * /reward/cnts:
 *   get:
 *     summary: 사용한 포상 / 리프레시 휴가 별 개수 조회
 *     tags: [Reward]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *           example: test
 *         required: true
 *         description: 아이디
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *           example: 2025
 *         required: true
 *         description: 기준 연도
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
 *                 data:
 *                    type: object
 *                    properties:
 *                      reward:
 *                        type: array
 *                        description: 포상 휴가
 *                        items:
 *                          type: object
 *                          properties:
 *                            휴가일수:
 *                              type: int
 *                              example: 5
 *                              description: 부여받은 휴가 일 수
 *                            사용일수:
 *                              type: int
 *                              example: 3
 *                              description: 사용한 휴가 일 수
 *                      refresh:
 *                        type: array
 *                        description: 리프레시 휴가
 *                        items:
 *                          type: object
 *                          properties:
 *                            휴가일수:
 *                              type: int
 *                              example: 5
 *                              description: 부여받은 휴가 일 수
 *                            사용일수:
 *                              type: int
 *                              example: 3
 *                              description: 사용한 휴가 일 수
 */
router.get("/cnts", async (req, res, next) => {
    let conn
	try {
		conn = await db.connection()
		const result = await db.multiSelect(conn, {
            reward : { query : rewardSql.selectRewardCnt("포상"), params : req.query },
            refresh : { query : rewardSql.selectRewardCnt("리프레시"), params : req.query },
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
