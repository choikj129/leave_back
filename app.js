let createError = require("http-errors")
let express = require("express")
let session = require("express-session")
let moment = require("moment")
let path = require("path")
let cookieParser = require("cookie-parser")
// let morgan = require("morgan")
let log4j = require("./exports/log4j")
let helmet = require("helmet")
let interceptor = require("./exports/interceptor")
let snapshot = require("./exports/snapshot")

const swaggerUi = require('swagger-ui-express')
const swaggerSpecs = require('./swagger/swagger.js')

if (process.argv.slice(2) && process.argv.slice(2)[0] == "maria") {
	log4j.log("Use Maria DB", "INFO")
	process.db = "maria"
}

let indexRouter = require("./routes/index")
let loginRouter = require("./routes/login")
let leaveRouter = require("./routes/leave")
let rewardRouter = require("./routes/reward")
let usersRouter = require("./routes/users")
let cronRouter = require("./routes/cron")
let apiRouter = require("./routes/api")
let holidayRouter = require("./routes/holiday")

let app = express()
// API 응답 캐시(304) 미사용 : DB 응답과 스냅샷 응답 본문이 같으면 304로 캐시된 응답의 스냅샷 헤더가 재사용됨
app.set("etag", false)

// view engine setup
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "ejs")

// morgan.format("dateTime", (req, res) => {
//   return moment().format("YYYY-MM-DD HH:mm:ss")
// })

app.use(helmet())
app.use(helmet.xssFilter())
// app.use(morgan("[:dateTime] :method :url :status"))
app.use(express.json({limit:'50mb'}))
app.use(express.urlencoded({ limit:'50mb', extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "public")))

app.use(
	session({
		secret: "odinue",
		resave: false,
		saveUninitialized: true,
		cookie : {
			maxAge: 24 * 60 * 60 * 1000,  // 세션 유지 기간 : 하루
		},
	})
)

app.use((req, res, next) => {
	const isSession = interceptor.session(req)
	try {
		if (isSession && !req.session.user.isManager && (
			(req.query?.id != undefined && req.query.id != req.session.user.id)
			|| (req.body?.id != undefined && req.body.id != req.session.user.id)
		)) {
			res.json({ status: false, msg: "not match session", data: [] })

			return
		}
		
		if (isSession
			|| req._parsedOriginalUrl.path.startsWith("/login")
			|| req._parsedOriginalUrl.path.startsWith("/cron")
			|| req._parsedOriginalUrl.path.endsWith("/test")
		) {
			next()
		} else {
			res.json({ status: false, msg: "no session", data: [] })

			return
		}
	} catch(e) {
		log4j.log(e)
	}
})

/* DB 장애 시 사용자(관리자 제외) 요청은 스냅샷으로 조회만 처리 */
app.use(snapshot.middleware)

app.use("/", indexRouter)
app.use("/login", loginRouter)
app.use("/leave", leaveRouter)
app.use("/reward", rewardRouter)
app.use("/users", usersRouter)
app.use("/cron", cronRouter)
app.use("/api", apiRouter) // deprecated
app.use("/holiday", holidayRouter)

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
	explorer: true,
	swaggerOptions: {
		tryItOutEnabled: true,
		tagsSorter: "alpha",
		apisSorter: 'alpha',
		operationsSorter: "method",
	},
}))

// catch 404 and forward to error handler
app.use((req, res, next) => {
	next(createError(404))
})

app.get((req, res) => {
	res.status(404).send('not found')
})

// error handler
app.use((err, req, res, next) => {
	// set locals, only providing error in development
	res.locals.message = err.message
	res.locals.error = req.app.get("env") === "development" ? err : {}

	// render the error page
	res.status(err.status || 500)
	res.render("error")
})

module.exports = app
