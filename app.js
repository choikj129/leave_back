let createError = require('http-errors');
let express = require('express');
let session = require('express-session');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');

let db = require("./config/oracle")

db.init()

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
    maxAge : 60 * 60 * 1000   // 세션 유지 1시간
  })
)

app.use('/', indexRouter);
app.use('/leave', leaveRouter);
app.use('/login', loginRouter);
app.use('/users', usersRouter);


// catch 404 and forward to error handler
app.use(function(req, res, next) {  
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};  
  
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
