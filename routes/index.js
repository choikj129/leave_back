let express = require('express');
let router = express.Router();
let dbconfig = require("../exports/oracle")

/* GET home page. */
router.get('/', (req, res, next) => {
  res.render("index", {title:"Express"})
});

router.post('/', (req, res, next) => {
  res.json({ title: 'Express' });
});

module.exports = router;
