let createError = require("http-errors")
let express = require("express")
let session = require("express-session")
let moment = require("moment")
let path = require("path")
let cookieParser = require("cookie-parser")
let morgan = require("morgan")
let helmet = require("helmet");
let interceptor = require("./exports/interceptor")


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

morgan.format("dateTime", (req, res) => {
  return moment().format("YYYY-MM-DD HH:mm:ss")
})

app.use(helmet())
app.use(helmet.xssFilter())
app.use(morgan("[:dateTime] :method :url :status"))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "public")))

app.use(
  session({
    secret : "odinue",
    resave : false,
    saveUninitialized : true,
    maxAge : 24 * 60 * 60 * 1000   // 세션 유지 기간 : 하루
  })
)

app.use((req, res, next) => {
  const isSession = interceptor.session(req)
  console.log(req._parsedOriginalUrl.path)
  if (isSession 
    || req._parsedOriginalUrl.path.startsWith("/login")
    || req._parsedOriginalUrl.path.startsWith("/cron")
    || req._parsedOriginalUrl.path.endsWith("/test")
  ) {
    next()
  } else {
    res.json({status : false, msg : "no session", data : []})
  }
})

app.use("/", indexRouter)
app.use("/login", loginRouter)
app.use("/leave", leaveRouter)
app.use("/reward", rewardRouter)
app.use("/users", usersRouter)
app.use("/cron", cronRouter)
app.use("/api", apiRouter)
app.use("/holiday", holidayRouter)

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404))
})

app.get((req,res)=>{
	res.status(404).send('not found');
});

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
