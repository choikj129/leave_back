let db = require("oracledb")
let config = require("./config/db_connect")
/*
    module.exports = {
        "user": "username",
        "password": "password",
        "connectString": "IP:Port/DATABASE"
    }
*/

db.initOracleClient({libDir:"C:\\oracle\\instantclient_21_8"})
db.outFormat = db.OUT_FORMAT_OBJECT
let conn = null;
module.exports = {
    connection : (callback) => {
        db.getConnection(
            {
                user          : config.user,
                password      : config.password,
                connectString : config.connectString,
            },
            (err, connection) =>{
                if (err) {
                    console.log("DB connection error")
                    console.error(err)
                    callback(false)
                } else {
                    conn = connection
                    callback(true)
                }
            }
            )
        },
        close : () => {
            console.log("DB Close")
            conn.close()
        },
        select : (query, params, callback) => {        
        conn.execute(query, params, (err, result) =>{
            if (err){
                console.log("DB select error")
                console.error(err)
                callback(false)
            }else{                
                callback(true, result.rows)                
            }
        })
    },
    update : (query, params, callback) => {
        conn.execute(query, params, (err, result) =>{
            if (err){
                console.log("DB update error")
                console.error(err)
                callback(false)
            }else{                
                callback(true, result.rowsAffected)                
            }
        })
    },
    updateBulk : (query, params, callback) => {
        conn.executeMany(query, params, (err, result) =>{
            if (err){
                console.log("DB update bulk error")
                console.error(err)
                callback(false)
            }else{                
                callback(true, result.rowsAffected)
            }
        })
    },
    commit : () => {
        console.log("DB commit")
        conn.commit()
    },
    rollback : () => {
        console.log("DB rollback")
        conn.rollback()
    },
}