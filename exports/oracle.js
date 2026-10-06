let db = require("oracledb")
let log4j = require("./log4j")
let config = require("./config/db_connect")
let funcs = require("./functions")
const path = require("./config/clientPath")
/*
    #config format

    - config
    module.exports = {
        "user": "username",
        "password": "password",
        "connectString": "IP:Port/DATABASE"
    }
    - path : instantclient 경로
*/

db.initOracleClient({ libDir: path })
db.outFormat = db.OUT_FORMAT_OBJECT

/* DB 서버 장애 시 응답 없이 대기하므로 접속 시간 제한 (ms) */
const CONNECT_TIMEOUT = 3000
/*
    장애 감지 후 재시도 간격 (ms)
    접속 시도는 시간 제한 후에도 드라이버 타임아웃(약 20초 이상)까지 libuv 스레드풀(기본 4개)을 점유하고,
    express.static 등 파일 처리도 같은 스레드풀을 사용하므로 장애 중 요청마다 접속을 시도하면 서버 전체가 멈춤
*/
const RETRY_INTERVAL = 30000
/*
    쿼리 1회 왕복 시간 제한 (ms). 풀에 열려 있던 커넥션은 DB 서버 장애 시 TCP 타임아웃(Linux 최대 약 15분)까지 응답 없이 대기
    시간 초과 시 서버에 중단 요청 후 한 번 더 대기하므로 실제 대기는 약 2배
    callTimeout은 Oracle Client 18 이상에서만 지원
*/
const CALL_TIMEOUT = 5000
/* DB 연결 끊김 오류 (호출 시간 초과, 통신 단절) */
const DISCONNECT_ERRORS = /DPI-1010|DPI-1067|DPI-1080|ORA-03113|ORA-03114|ORA-03135|ORA-03156|ORA-12170/
let downUntil = 0
let pendingCount = 0

/* 드라이버 호출 중인 수 (시간 제한으로 먼저 반환해도 실제 호출이 끝날 때까지 집계) */
const track = (promise) => {
    pendingCount++
    return promise.finally(() => pendingCount--)
}

/* 장애 감지 후 접속 성공 전까지 장애 상태 */
const isDown = () => downUntil > 0
/* 재시도 간격이 지났고 이전 접속 시도가 끝났으면 재시도 가능 */
const canRetry = () => Date.now() >= downUntil && pendingCount == 0
/* 쿼리 오류가 연결 끊김이면 장애 상태로 전환 */
const checkDisconnect = (e) => {
    if (!DISCONNECT_ERRORS.test(e?.message)) return
    downUntil = Date.now() + RETRY_INTERVAL
    log4j.log("DB 연결 끊김 감지 : " + e.message, "ERROR")
}

/* 풀 생성 실패 시 다음 접속 때 재생성 (서버 기동 시 DB가 죽어 있어도 복구되면 접속 가능) */
let poolPromise = null
const getPool = () => {
    if (!poolPromise) {
        poolPromise = db.createPool({
            user: config.user,
            password: config.password,
            connectString: config.connectString,
            poolMin : 0,
            poolMax : 10,
        }).catch((err) => {
            poolPromise = null
            log4j.log("createPool() error: " + err.message, "ERROR")
            throw err
        })
    }
    return poolPromise
}
getPool().catch(() => {})

/* 시간 초과 후 늦게 성공한 결과는 onLate로 정리 (커넥션 반납) */
const withTimeout = (promise, onLate) => {
    let timer
    let isTimeout = false
    return Promise.race([
        promise.then((result) => {
            if (isTimeout && onLate) onLate(result)
            return result
        }),
        new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                isTimeout = true
                reject(new Error("DB connection timeout"))
            }, CONNECT_TIMEOUT)
        }),
    ]).finally(() => clearTimeout(timer))
}

module.exports = {
    isDown,
    canRetry,
    connection: async () => {
        // 장애 감지 후 재시도 간격 전이거나, 이전 접속 시도가 아직 끝나지 않았으면 시도 없이 실패
        if (isDown() && !canRetry()) {
            throw new Error("DB connection error")
        }
        try {
            const pool = await withTimeout(track(getPool()))
            const connection = await withTimeout(track(pool.getConnection()), (conn) => conn.release().catch(() => {}))
            if (db.oracleClientVersion >= 1800000000) connection.callTimeout = CALL_TIMEOUT
            downUntil = 0
            log4j.log("DB connection success", "INFO")
            return connection
        } catch (e) {
            downUntil = Date.now() + RETRY_INTERVAL
            console.log(e)
            throw new Error("DB connection error")
        }
    },    
    select: async (conn, query, params = {}) => {
        query = funcs.replaceQuery(query, params)
        try {
            return await conn.execute(query, {})
                .then(result => {
                    log4j.log("DB select success", "INFO")
                    return result.rows
                })
        } catch(e) {
            checkDisconnect(e)
            log4j.log("==========================================================", "ERROR")
            log4j.log(query, "ERROR")
            log4j.log(e, "ERROR")
            log4j.log("==========================================================", "ERROR")
            throw new Error("DB select error")
        }
    },
    /* 다수의 select 쿼리 처리 */
    multiSelect : async (conn, hash = {}) => {
        /*
            hash = {
                key : {query : "", params : {}}
            }
            */
        let returnData = {}
        let key = null
        try {
            keys = Object.keys(hash)
            for (const k of keys) {
                key = k
                hash[key].query = funcs.replaceQuery(hash[key].query, hash[key].params)
                await conn.execute(hash[key].query, {})
                    .then(result => {
                        returnData[key] = result.rows
                    })
            }
            log4j.log("DB multi select success", "INFO")
            return returnData
        } catch(e) {
            checkDisconnect(e)
            log4j.log("==========================================================", "ERROR")
            log4j.log(hash[key].query, "ERROR")
            log4j.log(e, "ERROR")
            log4j.log("==========================================================", "ERROR")
            throw new Error("DB multi select error")
        }
        
    },
    update: async (conn, query, params = []) => {
        query = funcs.replaceQuery(query, params)
        try {
            return await conn.execute(query, {})
                .then(result => {
                    log4j.log("DB update success", "INFO")
                    return result.rowsAffected
                })
        } catch(e) {
            checkDisconnect(e)
            log4j.log("==========================================================", "ERROR")
            log4j.log(query, "ERROR")
            log4j.log(e, "ERROR")
            log4j.log("==========================================================", "ERROR")
            throw new Error("DB update error")
        }        
    },
    /* 다수의 select 쿼리 처리 */
    multiUpdate : async (conn, hash = {}) => {
        /*
            hash = {
                key : {query : "", params : {}}
            }
        */
        let returnData = {}
        let key = null
        try {
            keys = Object.keys(hash)
            for (const k of keys) {
                key = k
                hash[key].query = funcs.replaceQuery(hash[key].query, hash[key].params)
                await conn.execute(hash[key].query, {})
                    .then(result => {
                        returnData[key] = result.rowsAffected
                    })
            }
            log4j.log("DB multi update success", "INFO")
            return returnData
        } catch(e) {
            checkDisconnect(e)
            log4j.log("==========================================================", "ERROR")
            log4j.log(hash[key].query, "ERROR")
            log4j.log(e, "ERROR")
            log4j.log("==========================================================", "ERROR")
            throw new Error("DB multi update error")
        }
        
    },
    /* Bulk update */
    updateBulk: async (conn, query, params = []) => {
        /*
            SQL문이 모두 동일해야 하기 때문에 query replace는 불가
        */
        params = funcs.queryParamsFilter(query, params)
        if (params.length > 0) {
            try {
                return await conn.executeMany(query, params)
                    .then(result => {                    
                        log4j.log("DB update bulk success", "INFO")
                        return result.rowsAffected
                    })
            } catch (e) {
                checkDisconnect(e)
                log4j.log("==========================================================", "ERROR")
                log4j.log(query, "ERROR")
                log4j.log(e, "ERROR")
                log4j.log("==========================================================", "ERROR")
                throw new Error("DB update bulk error")
            }
        }else {
            log4j.log("No params data [update bulk]", "INFO")
            return []
        }
    },
    /* 다수의 Bulk update */
    multiUpdateBulk : async (conn, hash = {}) => {
        let returnData = {}
        let key = null
        try {
            keys = Object.keys(hash)
            for (const k of keys) {
                key = k
                const params = funcs.queryParamsFilter(hash[key].query, hash[key].params)
                if (params.length > 0) {
                    await conn.executeMany(hash[key].query, params)
                        .then(result => {
                            returnData[key] = result.rowsAffected
                        })
                } else {
                    returnData[key] = 0
                }
            }
            log4j.log("DB multi update bulk success", "INFO")
            return returnData
        } catch(e) {
            checkDisconnect(e)
            log4j.log("==========================================================", "ERROR")
            log4j.log(hash[key].query, "ERROR")
            log4j.log(e, "ERROR")
            log4j.log("==========================================================", "ERROR")
            throw new Error("DB multi update bulk error")
        }
    },
    close: (conn) => {
        try {
            log4j.log("DB Close", "INFO")
            conn.release()
        } catch {
            log4j.log("Invalid connection", "ERROR")
        }
    },
    commit: async (conn) => {
        try {
            log4j.log("DB commit", "INFO")
            await conn.commit()
        } catch {
            log4j.log("Commit error", "ERROR")
        }
    },
    rollback: async (conn) => {
        try {
            log4j.log("DB rollback", "INFO")
            await conn.rollback()
        } catch {
            log4j.log("Rollback error", "ERROR")
        }
    },
}