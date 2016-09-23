var express = require('express');
var path = require('path');
var fs = require('fs');
var logger = require('morgan');
var compression = require('compression');
var methodOverride = require('method-override');
var session = require('express-session');
var flash = require('express-flash');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var dotenv = require('dotenv');
var _ = require('lodash');
var multer = require('multer');
var nunjucks = require('nunjucks');
var csrf = require('csurf');
var csrfProtection = csrf();
var auth = require('basic-auth');

// Load environment variables from .env file
dotenv.load();

// Controllers
var CommandController = require('./controllers/command');

var app = express();

// view engine setup
var nunjucksEnv = nunjucks.configure('views', {
  autoescape: true,
  express: app
});

nunjucksEnv.addFilter('json', function JSONstringify(obj) {
  return JSON.stringify(obj, null, 4);
});

nunjucksEnv.addFilter('last_modified', function lastModified(file, dir) {
  var stat;
  try {
    stat = fs.statSync(path.resolve(dir, file));
  } catch (err) {
  };

  if (stat && stat.mtime) {
    return stat.mtime;
  } else{
    return 'File does not exist';
  }
});

nunjucksEnv.addFilter('readfile', function lastModified(file, dir) {
  var contents = '';
  try {
    contents = fs.readFileSync(path.resolve(dir, file), 'utf8');
  } catch (err) {
    contents = '';
  };

  return contents;
});

app.set('view engine', 'html');
app.set('port', process.env.PORT || 3000);
app.use(compression());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer({dest:'./temp_uploads/'}).any());
app.use(expressValidator());
app.use(methodOverride('_method'));
app.use(session({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));
app.use(csrf());
app.use(flash());

if (process.env.HTTP_AUTH_USERNAME) {
  app.use(function(req, res, next) {
      var user = auth(req);

      if (user === undefined || user['name'] !== process.env.HTTP_AUTH_USERNAME || user['pass'] !== process.env.HTTP_AUTH_PASSWORD) {
          res.statusCode = 401;
          res.setHeader('WWW-Authenticate', 'Basic realm="CMDWrap"');
          res.end('Unauthorized');
      } else {
          next();
      }
  });
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', CommandController.index);
app.get('/:command', CommandController.prepare);
app.get('/:command/view', CommandController.fileView);
app.post('/:command', csrfProtection, CommandController.launch);

app.use(function (err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);
  console.error(err, err.stack);

  // handle CSRF token errors here
    res.sendStatus(err.status || 403);
});

// Production error handler
if (app.get('env') === 'production') {
  app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.sendStatus(err.status || 500);
  });
}

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

module.exports = app;
