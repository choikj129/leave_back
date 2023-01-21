let db = require("oracledb")
let config = require("./config/db_connect")
/*
    module.exports = {
        "user": "username",
        "password": "password",
        "connectString": "IP:Port/DATABASE"
    }
*/

db.initOracleClient({ libDir: "C:\\oracle\\instantclient_21_8" })
db.outFormat = db.OUT_FORMAT_OBJECT
let conn = null;
module.exports = {
    connection: (callback) => {
        db.getConnection(
            {
                user: config.user,
                password: config.password,
                connectString: config.connectString,
            },
            (err, connection) => {
                if (err) {
                    console.log("DB connection error")
                    console.error(err)
                    callback(false)
                } else {
                    console.log("DB connection success")
                    conn = connection
                    callback(true)
                }
            }
        )
    },
    close: () => {
        console.log("DB Close")
        conn.close()
    },
    select: (query, params, callback) => {
        conn.execute(query, params, (err, result) => {
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
    // multiSelect : (hash, callback) => {
        
    // },
    update: (query, params, callback) => {
        if (params.length > 0) {
            conn.execute(query, params, (err, result) => {
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
        } else {
            callback(true, 0)
        }
    },
    updateBulk: (query, params, callback) => {
        if (params.length > 0) {
            conn.executeMany(query, params, (err, result) => {
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
    multiUpdateBulk : (hash, callback) => {
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
    commit: () => {
        console.log("DB commit")
        conn.commit()
    },
    rollback: () => {
        console.log("DB rollback")
        conn.rollback()
    },
}