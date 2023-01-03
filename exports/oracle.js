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
            function(err, connection){
                if (err) {
                    callback(false, conn)
                } else {
                    conn = connection
                    callback(true, conn)
                }
            }
        )
    },
    close : () => {
        conn.close()
    },
    select : async (query, params, callback) => {
        await conn.execute(query, params, function(err, result){
            if (err){
                console.error(err)
                callback(false)
            }else{                
                callback(true, result.rows)                
            }
        })
    },
    update : async (query, params, callback) => {
        await conn.execute(query, params, function(err, result){
            if (err){
                console.error(err)
                callback(false)
            }else{                
                callback(true, result.rowsAffected)                
            }
        })
    },
    updateBulk : async (query, params, callback) => {
        await conn.executeMany(query, params, function(err, result){
            if (err){
                console.error(err)
                callback(false)
            }else{                
                callback(true, result.rowsAffected)
            }
        })
    },
    commit : () => {
        conn.commit()
    },
    rollback : () => {
        conn.rollback()
    },
}