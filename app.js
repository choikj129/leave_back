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
	log4j.log(`${req.method} ${req._parsedOriginalUrl.path}`, "INFO")
	if (isSession
		|| req._parsedOriginalUrl.path.startsWith("/login")
		|| req._parsedOriginalUrl.path.startsWith("/cron")
		|| req._parsedOriginalUrl.path.endsWith("/test")
	) {
		next()
	} else {
		res.json({ status: false, msg: "no session", data: [] })
	}
})

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
