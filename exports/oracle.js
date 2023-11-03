let db = require("oracledb")
let log4j = require("./log4j")
let config = require("./config/db_connect")
let funcs = require("./functions");
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
let pool = null
db.createPool({
    user: config.user,
    password: config.password,
    connectString: config.connectString,
    poolMin : 0,
    poolMax : 10,
}, (err, conn) => {
    if (err) {
        log4j.log("createPool() error: " + err.message, "ERROR")
        return;
    }
    pool = conn
})

module.exports = {
    connection: async () => {
        try {
            return await pool.getConnection()
                .then((connection) => {
                    log4j.log("DB connection success", "INFO")
                    return connection
                })
        } catch (e) {
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
            conn.close()
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