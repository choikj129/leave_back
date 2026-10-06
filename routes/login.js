let express = require("express")
let router = express.Router()
let log4j = require("../exports/log4j")
let kakaowork = require("../exports/kakaowork")
let funcs = require("../exports/functions")
let snapshot = require("../exports/snapshot")

// ${process.db}로 동적으로 하려 했지만 Ctrl 추적이 안돼서 기본 값은 그냥 하드코딩 함
let db = require("../exports/oracle")
let commonSql = require("../oracle/sql_common")
if ((process.db || "oracle") != "oracle") {
	db = require(`../exports/${process.db}`)
	commonSql = require(`../${process.db}/sql_common`)
} 

/**
 * @swagger
 * /login:
 *   post:
 *     summary: 로그인
 *     tags: [Login]
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
 *               pw:
 *                 type: string
 *                 example: test1234
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
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: test
 *                       description: 아이디
 *                     name:
 *                       type: string
 *                       example: 테스트
 *                       description: 이름
 */
/* DB 접속 불가 시 스냅샷으로 로그인 (사용자만, 조회만 가능) */
const loginSnapshot = (req, res, userAgent) => {
	const login = snapshot.getLogin(req.body.id)
	if (!login) {
		funcs.sendFail(res, "DB 접속 불가. 잠시 후 다시 시도해주세요.")
		return
	}
	const data = login.user
	if (data?.관리자여부 == "Y") {
		funcs.sendFail(res, "DB 접속 불가로 관리자는 로그인할 수 없습니다.")
		return
	}
	if (!data || data.비밀번호 != funcs.encrypt(req.body.pw)) {
		funcs.sendFail(res, "로그인 정보 없음")
		return
	}
	req.session.user = {
		id: data.아이디,
		name: data.이름,
		position: data.직위,
		isManager : false,
		isLogin : true,
		isMobile : /mobile/i.test(userAgent),
		isSnapshot : true,
		snapshotAt : login.createdAt,
	}
	funcs.sendSuccess(res, req.session.user, snapshot.READ_ONLY_MSG)
	log4j.log(`(${req.body.id}) - 스냅샷 로그인 (${login.createdAt} 기준)`, "INFO")
}

router.post("/", async (req, res, next) => {
	let conn
	const userAgent = req.get('User-Agent')
	try {
		conn = await db.connection()
	} catch (e) {
		loginSnapshot(req, res, userAgent)
		return
	}
	try {
		const pw = funcs.encrypt(req.body.pw)
		const params = { id: req.body.id, pw: pw }
		const result = await db.select(conn, commonSql.selectEmpInfo, params)
		if (result.length == 0) {
			funcs.sendFail(res, "로그인 정보 없음")
		} else {
			const data = result[0]
			req.session.user = {
				id: data.아이디,
				name: data.이름,
				position: data.직위,
				isManager : data.관리자여부 == "Y" ? true : false,
				isLogin : true,
				isMobile : /mobile/i.test(userAgent),
			}

			funcs.sendSuccess(res, req.session.user)
		}
		log4j.log(`(${req.body.id}) - User-Agent : ${userAgent}`, "INFO")
	} catch (e) {
		console.error(e)
		// 접속 후 조회 중 연결이 끊긴 경우 (풀에 열려 있던 커넥션)
		if (db.isDown()) {
			loginSnapshot(req, res, userAgent)
			return
		}
		funcs.sendFail(res, e)
	} finally {
		db.close(conn)
	}
})

/* 비밀번호 변경 */
router.patch("/", db.transaction(async (req, res, conn) => {
	const pw = funcs.encrypt(req.body.pw)
	const params = { id: req.body.id, pw: pw }
	return await db.update(conn, commonSql.updatePassword, params)
}))

/* 비밀번호 초기화 */
router.patch("/reset", db.transaction(async (req, res, conn) => {
	let params = { id : req.body.id, name : req.body.name }
	const result = await db.select(conn, commonSql.selectEmpEmail, params)
	if (result.length == 0) throw "사용자가 존재하지 않습니다."

	const email = result[0].이메일
	const userId = await kakaowork.getUserId(email)
	if (!userId) throw `카카오워크 이메일(${email})을 찾을 수 없습니다.`

	const convId = await kakaowork.conversationOpen(userId)
	if (!convId) throw "카카오워크를 전송 오류."

	const key = funcs.randomChar()
	params.pw = funcs.encrypt(key)
	await db.update(conn, commonSql.updatePassword, params)

	await kakaowork.sendMessage(`휴가웹 임시 비밀번호\n${key}`, convId)

	res.locals.msg = "임시 비밀번호를 카카오워크로 전송했습니다."
}))

module.exports = router
