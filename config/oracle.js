let db = require("oracledb")
db.initOracleClient({libDir:"C:\\oracle\\instantclient_21_7"})
db.outFormat = db.OUT_FORMAT_OBJECT
let conn = null;
module.exports = {
    init : () => {
        db.getConnection(
            {
                user          : "ODN_GJCHOI",
                password      : "m1m2m3",
                connectString : "192.168.10.12:41522/XE",
            },
            function(err, connection){
                conn = connection                                        
            }
        )
    },
    select : async (query, params, callback) => {
        await conn.execute(query, params, function(err, result){
            if (err){
                callback(false)
            }else{                
                callback(result.rows)                
            }
        })
    }
    
}