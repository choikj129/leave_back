let db = require("oracledb")
let config = require("./exports/db_connect")
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
    init : () => {
        db.getConnection(
            {
                user          : config.user,
                password      : config.password,
                connectString : config.connectString,
            },
            function(err, connection){
                conn = connection
            }
        )
    },
    select : async (query, params, callback) => {
        await conn.execute(query, params, function(err, result){
            if (err){
                console.error(err)
                callback(false)
            }else{                
                callback(result.rows)                
            }
        })
    },
    insert : async (query, params, callback) => {
        await conn.execute(query, params, function(err, result){
            if (err){
                console.error(err)
                callback(false)
            }else{                
                callback(result.rows)                
            }
        })
    },
    insertBulk : async (query, params, callback) => {
        await conn.executeMany(query, params, function(err, result){
            if (err){
                console.error(err)
                callback(false)
            }else{                
                callback(result.rows)                
            }
        })
    },
}