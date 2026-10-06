let fs = require("fs")
let path = require("path")
let cron = require("node-cron")
let moment = require("moment")
let log4j = require("./log4j")

/*
    정기 작업 실행 관리 (DB/외부 API 장애, 서버 중단 대비)
    - 10분마다 + 서버 기동 시, 이번 주기(key)에 성공 이력이 없고 실행 시각(dueAt)이 지난 작업을 실행
    - 실패 시 다음 확인 때 재시도, 서버가 꺼져 있던 동안 놓친 작업은 기동 시 실행
    - until : 놓친 작업을 따라잡는 기한 (기한 이후에는 실행하지 않음)
    - 실행 이력 : state/cron.json { key : { done, tries, at, lastError } }
    재시도/중복 실행될 수 있으므로 작업은 여러 번 실행해도 결과가 같아야 함
*/
const dir = path.join(__dirname, "../state")
const stateFile = path.join(dir, "cron.json")

let isRunning = false

const readState = () => {
    try {
        return fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {}
    } catch (e) {
        log4j.log(`cron 실행 이력 읽기 실패 : ${e}`, "ERROR")
        return {}
    }
}

/* 임시 파일에 쓴 후 교체 (쓰는 도중 장애 시 기존 파일 유지) */
const writeState = (state) => {
    fs.mkdirSync(dir, { recursive : true })
    const tmp = stateFile + ".tmp"
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
    fs.renameSync(tmp, stateFile)
}

const check = async (jobs, now = new Date()) => {
    if (isRunning) return
    isRunning = true
    try {
        for (const job of jobs) {
            const key = job.key(now)
            let state = readState()
            if (state[key]?.done || now < job.dueAt(now) || (job.until && now >= job.until(now))) continue

            const tries = (state[key]?.tries || 0) + 1
            const at = moment().format("YYYY-MM-DD HH:mm:ss")
            try {
                await job.run(now)
                state = readState()
                state[key] = { done : true, tries : tries, at : at }
                log4j.log(`[${key}] ${job.name} 성공 (${tries}회차)`)
            } catch (e) {
                state = readState()
                state[key] = { done : false, tries : tries, at : at, lastError : String(e) }
                log4j.log(`[${key}] ${job.name} 실패 (${tries}회차), 10분 후 재시도 : ${e}`, "ERROR")
            }
            writeState(state)
        }
    } catch (e) {
        log4j.log(`cron 실행 확인 오류 : ${e}`, "ERROR")
    } finally {
        isRunning = false
    }
}

module.exports = {
    check,
    readState,
    /* 실행 이력 외 상태 값 변경 (알림 전송 여부 등) */
    updateState : (fn) => {
        const state = readState()
        fn(state)
        writeState(state)
    },
    start : (jobs) => {
        cron.schedule("0 */10 * * * *", () => check(jobs))
        check(jobs)
    },
}
