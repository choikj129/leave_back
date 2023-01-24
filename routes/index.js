let express = require('express');
let router = express.Router();
let dbconfig = require("../exports/oracle")
let funcs = require("../exports/functions");

/* GET home page. */
router.get('/logout', (req, res, next) => {
	req.session.destroy(function (err) {
		if (err) {
			console.log(err);
			funcs.sendFail(res, "Logout session destroy Error")
		} else {
			funcs.sendSuccess(res)
		}
		console.log(req.session)
	})
});

module.exports = router;
