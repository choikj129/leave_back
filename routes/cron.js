let express = require('express');
let router = express.Router();
let dbconfig = require("../exports/oracle")
let funcs = require("../exports/functions");

/* GET home page. */
router.get('/leave', (req, res, next) => {
	console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")
});

module.exports = router;
