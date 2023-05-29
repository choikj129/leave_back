let db = require("oracledb")
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
        console.error("createPool() error: " + err.message);
        return;
    }
    pool = conn
})

module.exports = {
    connection: async () => {
        try {
            return await pool.getConnection()
                .then((connection) => {
                    console.log("DB connection success")
                    return connection
                })
        } catch (e) {
            throw new Error("DB connection error")
        }
    },    
    select: async (conn, query, params = {}) => {
        query = funcs.replaceQuery(query, params)
        try {
            return await conn.execute(query, {})
                .then(result => {
                    console.log("DB select success")
                    return result.rows
                })
        } catch(e) {
            console.error("==========================================================")
            console.error(query)
            console.error("==========================================================")
            console.error(e)
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
            console.log("DB multi select success")
            return returnData
        } catch(e) {
            console.error("==========================================================")
            console.error(hash[key].query)
            console.error("==========================================================")
            console.error(e)
            throw new Error("DB multi select error")
        }
        
    },
    update: async (conn, query, params = []) => {
        query = funcs.replaceQuery(query, params)
        try {
            return await conn.execute(query, {})
                .then(result => {
                    console.log("DB update success")
                    return result.rowsAffected
                })
        } catch(e) {
            console.error("==========================================================")
            console.error(query)
            console.error("==========================================================")
            console.error(e)
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
            console.log("DB multi update success")
            return returnData
        } catch(e) {
            console.error("==========================================================")
            console.error(hash[key].query)
            console.error("==========================================================")
            console.error(e)
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
                        console.log("DB update bulk success")
                        return result.rowsAffected
                    })
            } catch (e) {
                console.error("==========================================================")
                console.error(query)
                console.error("==========================================================")
                console.error(e)
                throw new Error("DB update bulk error")
            }
        }else {
            console.log("No params data [update bulk]")
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
            console.log("DB multi update bulk success")
            return returnData
        } catch(e) {
            console.error("==========================================================")
            console.error(hash[key].query)
            console.error("==========================================================")
            console.error(e)
            throw new Error("DB multi update bulk error")
        }
    },
    close: (conn) => {
        try {
            console.log("DB Close")
            conn.close()
        } catch {
            console.error("Invalid connection")
        }
    },
    commit: async (conn) => {
        try {
            console.log("DB commit")
            await conn.commit()
        } catch {
            console.error("Commit error")
        }
    },
    rollback: async (conn) => {
        try {
            console.log("DB rollback")
            await conn.rollback()
        } catch {
            console.error("Rollback error")
        }
    },
}