let express = require('express');
const { password } = require('../public/js/oracle');
let router = express.Router();
let dbconfig = require("../public/js/oracle")
let db = require("oracledb");

db.initOracleClient({libDir:"C:\\oracle\\instantclient_21_7"})
db.outFormat = db.OUT_FORMAT_OBJECT

let conn;
db.getConnection(
  dbconfig,
  function(err, connection){
    conn = connection
  }
)

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/', function(req, res, next) {
  conn.execute("select 1 from dual", {}, function(err, res){
    console.log(res)
  })
  
  res.json({ title: 'Express' });
});

module.exports = router;
