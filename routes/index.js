let express = require('express');
let router = express.Router();
let dbconfig = require("../exports/oracle")

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render("index", {title:"Express"})
});

router.post('/', function(req, res, next) {
  res.json({ title: 'Express' });
});

module.exports = router;
