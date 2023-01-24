let createError = require('http-errors');
let express = require('express');
let session = require('express-session');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');
let interceptor = require("./exports/interceptor")


let indexRouter = require('./routes/index');
let loginRouter = require('./routes/login');
let leaveRouter = require('./routes/leave');
let usersRouter = require('./routes/users');

let app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

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
  if (req._parsedOriginalUrl.path == "/login" || isSession) {
    next()
  } else {
    res.json({status : false, msg : "no session", data : []})
  }
})

app.use('/', indexRouter);
app.use('/leave', leaveRouter);
app.use('/login', loginRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {  
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};  
  
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
