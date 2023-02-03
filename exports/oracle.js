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
    connection: (callback) => {        
        pool.getConnection(
            (err, connection) => {
                if (err) {
                    console.log("DB connection error")
                    console.error(err)
                    callback(false)
                } else {
                    console.log("DB connection success")
                    /* 리턴한 connection 객체 사용 */
                    callback(true, connection)
                }
            }
        )
    },
    close: (conn) => {
        try {
            console.log("DB Close")
            conn.close()
        } catch {
            console.log("invalid connection")
        }
    },
    select: (conn, query, params, callback) => {
        query = funcs.replaceQuery(query, params)
        conn.execute(query, {}, (err, result) => {
            if (err) {
                console.log("DB select error")
                console.log("==========================================================")
                console.log(query)
                console.log("==========================================================")
                console.error(err)
                callback(false)
            } else {
                callback(true, result.rows)
            }
        })
    },
    /* 다수의 select 쿼리 처리 */
    multiSelect : (conn, hash, callback) => {
        /* 
            hash = {
                key : {query : "", params : {}}
            }
        */
        keys = Object.keys(hash)
        if (keys.length > 0) {
            returnData = {}
            keys.forEach((key, i) => {
                hash[key].query = funcs.replaceQuery(hash[key].query, hash[key].params)
                conn.execute(hash[key].query, {}, (err, result) => {
                    if (err) {
                        console.log("DB multi select error")
                        console.log("==========================================================")
                        console.log(hash[key].query)
                        console.log("==========================================================")
                        console.error(err)
                        callback(false)
                        return false;
                    } else {
                        returnData[key] = result.rows
                        if (i == keys.length -1) {
                            callback(true, returnData)
                        }
                    }
                })
            })
        } else {
            callback(true, 0)
        }
        
    },
    update: (conn, query, params, callback) => {
        query = funcs.replaceQuery(query, params)
        conn.execute(query, {}, (err, result) => {
            if (err) {
                console.log("DB update error")
                console.log("==========================================================")
                console.log(query)
                console.log("==========================================================")
                console.error(err)
                callback(false)
            } else {
                callback(true, result.rowsAffected)
            }
        })
    },
    /* Bulk update */
    updateBulk: (conn, query, params, callback) => {        
        /* SQL문이 모두 동일해야 하기 때문에 query replace는 불가 */
        query = funcs.replaceQuery(query, params)
        if (params.length > 0) {
            conn.executeMany(query, {}, (err, result) => {
                if (err) {
                    console.log("DB update bulk error")
                    console.log("==========================================================")
                    console.log(query)
                    console.log("==========================================================")
                    console.error(err)
                    callback(false)
                } else {
                    callback(true, result.rowsAffected)
                }
            })
        }else {
            callback(true, 0)
        }
    },
    /* 다수의 Bulk update */
    multiUpdateBulk : (conn, hash, callback) => {
        keys = Object.keys(hash)
        if (keys.length > 0) {
            returnData = {}
            keys.forEach((key, i) => {
                conn.executeMany(hash[key].query, hash[key].params, (err, result) => {
                    if (err) {
                        console.log("DB multi update bulk error")
                        console.log("==========================================================")
                        console.log(hash[key].query)
                        console.log("==========================================================")
                        console.error(err)
                        callback(false)
                        return false;
                    } else {
                        returnData[key] = result.rowsAffected
                        if (i == keys.length -1) {
                            callback(true, returnData)
                        }
                    }
                })
            })
        } else {
            callback(true, 0)
        }
    },
    commit: (conn) => {
        console.log("DB commit")
        conn.commit()
    },
    rollback: (conn) => {
        console.log("DB rollback")
        conn.rollback()
    },
}