let fs = require("fs")
let path = require("path")
let moment = require("moment")
let log4j = require("./log4j")
let funcs = require("./functions")
let db = require("./oracle")
let snapshotSql = require("../oracle/sql_snapshot")
let commonSql = require("../oracle/sql_common")
let leaveSql = require("../oracle/sql_leave")
let usersSql = require("../oracle/sql_users")
let rewardSql = require("../oracle/sql_reward")
let holidaySql = require("../oracle/sql_holiday")

/*
    DB 서버 장애 대비 조회 API 스냅샷
    - data.json  : { createdAt, routes : { "API 경로" : { "조회 키" : 응답 data } } }
    - login.json : { createdAt, users : { 아이디 : 로그인 정보 } } (관리자는 비밀번호 미저장)
    DB 장애 시 사용자(관리자 제외) 요청은 스냅샷으로 처리 (조회만 가능)
    - DB 접속 불가 상태로 로그인한 세션 : 재로그인 전까지 항상 스냅샷
    - 일반 세션 : DB 장애 중에만 스냅샷, 복구되면 DB 사용
    스냅샷 응답에는 X-Snapshot-At 헤더(스냅샷 기준 시각)를 추가해 프론트에서 조회 전용 모드 표시
*/
const dir = path.join(__dirname, "../snapshot")
const dataFile = path.join(dir, "data.json")
const loginFile = path.join(dir, "login.json")

const READ_ONLY_MSG = "DB 접속 불가로 조회만 가능합니다."
const SNAPSHOT_HEADER = "X-Snapshot-At"

const byIdYear = (req) => `${req.query.id}|${req.query.year}`
const emptyReward = () => ({ reward : [], refresh : [] })

/* 스냅샷으로 응답하는 GET API. key : 요청 → 조회 키, empty : 키가 없을 때 응답 */
const routes = {
    "/birthday" : { key : () => "" },
    "/code" : { key : (req) => `${req.query.name}|${req.query.reverse ? "DESC" : "ASC"}` },
    "/leave" : { key : (req) => req.query.id || "" },
    "/leave/cnts" : { key : (req) => req.query.id },
    "/leave/lists" : { key : byIdYear },
    "/leave/history" : { key : () => "" },
    "/users" : { key : (req) => `${req.session.user.id}|${req.query.year}` },
    "/holiday" : { key : (req) => req.query.year },
    "/holiday/detail" : { key : () => "" },
    "/reward" : { key : byIdYear },
    "/reward/user" : { key : byIdYear, empty : emptyReward },
    "/reward/cnts" : { key : byIdYear, empty : emptyReward },
}
/* 스냅샷 세션에서도 그대로 처리할 API (DB 미사용 또는 재로그인) */
const passRoutes = ["GET /logout", "GET /download", "POST /login"]

let cache = { data : null, login : null }
let isCreating = false

const readJson = (file) => {
    try {
        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null
    } catch (e) {
        log4j.log(`스냅샷 파일 읽기 실패 (${file}) : ${e}`, "ERROR")
        return null
    }
}

/* 임시 파일에 쓴 후 교체 (쓰는 도중 장애 시 기존 파일 유지) */
const writeJson = (file, json) => {
    const tmp = file + ".tmp"
    fs.writeFileSync(tmp, JSON.stringify(json), { mode : 0o600 })
    fs.renameSync(tmp, file)
}

const getData = () => {
    if (!cache.data) cache.data = readJson(dataFile)
    return cache.data
}

const getLoginData = () => {
    if (!cache.login) cache.login = readJson(loginFile)
    return cache.login
}

const create = async () => {
    if (isCreating) return
    isCreating = true
    log4j.log("스냅샷 생성 시작")

    let conn
    try {
        conn = await db.connection()
        /* 1,000건 내외의 쿼리를 실행하므로 db.select의 쿼리별 로그 없이 실행 */
        const select = async (query, params = {}) => {
            const result = await conn.execute(funcs.replaceQuery(query, params), {})
            return result.rows
        }
        const createdAt = moment().format("YYYY-MM-DD HH:mm")
        const thisYear = String(new Date().getFullYear())

        let data = {}
        Object.keys(routes).forEach(route => data[route] = {})

        /* 로그인 정보 & 조회 대상 (관리자는 DB 장애 시 로그인 불가) */
        const emps = await select(snapshotSql.selectLoginEmps)
        let loginUsers = {}
        emps.forEach(emp => {
            loginUsers[emp.아이디] = emp.관리자여부 == "Y" ? { 관리자여부 : "Y" } : emp
        })
        const ids = new Set(emps.filter(emp => emp.관리자여부 != "Y").map(emp => emp.아이디))

        /* 공통 */
        data["/birthday"][""] = await funcs.makeBirthdays(await select(commonSql.selectEmpBirthday))
        for (const row of await select(snapshotSql.selectCodeNames)) {
            for (const sort of ["ASC", "DESC"]) {
                data["/code"][`${row.코드구분}|${sort}`] = await select(commonSql.selectCommonCode(sort), { name : row.코드구분 })
            }
        }
        data["/leave"][""] = await select(leaveSql.selectLeaveInfo())
        data["/leave/history"][""] = await select(leaveSql.selectLeaveHistory)
        data["/holiday/detail"][""] = await select(holidaySql.selectDetailHolidays)
        for (const row of await select(snapshotSql.selectHolidayYears)) {
            data["/holiday"][row.연도] = await select(holidaySql.selectHolidays, { year : row.연도 })
        }

        /* 사용자별 */
        for (const id of ids) {
            data["/leave"][id] = await select(leaveSql.selectLeaveInfo(id), { id : id })
            data["/leave/cnts"][id] = await select(leaveSql.selectLeaveCnts, { id : id })
        }

        /* 사용자 & 연도별 : 데이터가 있는 조합만 조회 (없는 조합은 빈 값 응답) */
        let years = new Set([thisYear])
        for (const row of await select(snapshotSql.selectLeaveCntYears)) years.add(row.연도)

        for (const row of await select(snapshotSql.selectLeaveUserYears)) {
            years.add(row.연도)
            if (!ids.has(row.아이디)) continue
            data["/leave/lists"][`${row.아이디}|${row.연도}`] = await select(leaveSql.selectUseLeaveInfo, { id : row.아이디, year : row.연도 })
        }

        for (const row of await select(snapshotSql.selectRewardUserYears)) {
            years.add(row.연도)
            if (!ids.has(row.아이디)) continue
            const key = `${row.아이디}|${row.연도}`
            const params = { id : row.아이디, year : row.연도 }
            data["/reward"][key] = await select(rewardSql.selectEmpReward, params)
            data["/reward/user"][key] = {
                reward : await select(rewardSql.selectReward("포상"), params),
                refresh : await select(rewardSql.selectReward("리프레시"), params),
            }
            data["/reward/cnts"][key] = {
                reward : await select(rewardSql.selectRewardCnt("포상"), params),
                refresh : await select(rewardSql.selectRewardCnt("리프레시"), params),
            }
        }

        /* 전 직원 조회 후 본인 행만 응답하도록 분리 */
        for (const year of years) {
            for (const row of await select(usersSql.selectUsersInfo(""), { year : year })) {
                if (ids.has(row.아이디)) data["/users"][`${row.아이디}|${year}`] = [row]
            }
        }

        const dataJson = { createdAt : createdAt, routes : data }
        const loginJson = { createdAt : createdAt, users : loginUsers }
        fs.mkdirSync(dir, { recursive : true, mode : 0o700 })
        writeJson(dataFile, dataJson)
        writeJson(loginFile, loginJson)
        cache = { data : dataJson, login : loginJson }

        log4j.log(`스냅샷 생성 완료 (${createdAt}, ${Math.round(fs.statSync(dataFile).size / 1024)}KB)`)
    } catch (e) {
        log4j.log(`스냅샷 생성 실패. 기존 스냅샷 유지 : ${e}`, "ERROR")
    } finally {
        if (conn) db.close(conn)
        isCreating = false
    }
}

/* 스냅샷으로 요청 처리 : 조회 API는 스냅샷 응답, 그 외는 조회 전용 안내 (DB 미사용 API는 통과) */
const handle = (req, res, next) => {
    // 라우터 안에서 호출되면 req.path는 마운트 경로 제외 (/leave/cnts → /cnts)
    const route = (req.baseUrl + req.path).replace(/\/+$/, "") || "/"
    if (passRoutes.includes(`${req.method} ${route}`) || route.startsWith("/api-docs")) {
        next()
        return
    }
    const snapshot = getData()
    if (snapshot) res.set(SNAPSHOT_HEADER, snapshot.createdAt)
    if (req.method != "GET" || !routes[route]) {
        funcs.sendFail(res, READ_ONLY_MSG)
        return
    }
    const data = snapshot?.routes[route]?.[routes[route].key(req)]
    funcs.sendSuccess(res, data ?? (routes[route].empty ? routes[route].empty() : []))
}

module.exports = {
    READ_ONLY_MSG,
    create,
    handle,
    exists : () => fs.existsSync(dataFile) && fs.existsSync(loginFile),
    /* { createdAt, user } 반환. 스냅샷이 없으면 null */
    getLogin : (id) => {
        const login = getLoginData()
        if (!login || !getData()) return null
        return { createdAt : login.createdAt, user : login.users[id] }
    },
    /* 로그인한 사용자(관리자 제외) 요청 중 DB 장애 시 스냅샷으로 처리 */
    middleware : (req, res, next) => {
        const user = req.session.user
        if (!user || user.isManager) {
            next()
            return
        }
        // 스냅샷 로그인 세션이거나, DB 장애 중이고 재시도 시점 전이면 DB 접속 없이 스냅샷
        if (user.isSnapshot || (db.isDown() && !db.canRetry())) {
            handle(req, res, next)
            return
        }
        // DB 사용. 접속 실패로 장애가 감지되면 실패 응답을 스냅샷 응답으로 대체
        const json = res.json
        res.json = (body) => {
            res.json = json
            if (body?.status === false && db.isDown()) {
                handle(req, res, () => json.call(res, body))
            } else {
                json.call(res, body)
            }
            return res
        }
        next()
    },
}
