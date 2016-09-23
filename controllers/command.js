var _ = require('lodash');

/**
 * GET /
 *
 * Commands list
 */
exports.index = function(req, res) {
  exports.getCommandsList(function(err, commands){
    if (err) {
      req.flash('error', { msg: err.message });
    }

    commands = commands || {};

    res.render('home', {
      title: 'Choose available commands',
      commands: commands
    });
  });
};

/**
 * GET /command
 *
 * Individual command preparation/page
 */
exports.prepare = function(req, res) {
  var command = req.params.command,
      fs = require('fs');

  exports.getCommandsList(function(err, commands){
    if (err) {
      req.flash('error', { msg: err.message });
      return res.redirect('/');
    }

    if (!commands[command]) {
      req.flash('error', { msg: 'Undefined command!' });
      return res.redirect('/');
    }

    commands[command].isRunning = exports.isRunning(commands[command].lockFile);

    res.render('command', {
      title: 'Prepare for execution',
      csrfToken: req.csrfToken(),
      command_key: req.params.command,
      command: commands[command]
    });
  });
};

/**
 * GET /command/file
 *
 * Command public files and logs
 */
exports.fileView = function(req, res) {
  var command = req.params.command,
      file = req.query.file,
      fs = require('fs'),
      path = require('path'),
      publicFiles = [],
      filepath;

  exports.getCommandsList(function(err, commands){
    if (err) {
      req.flash('error', { msg: err.message });
      return res.redirect('/');
    }

    if (!commands[command]) {
      req.flash('error', { msg: 'Undefined command!' });
      return res.redirect('/');
    }

    if (!file) {
      req.flash('error', { msg: 'Undefined file!' });
      return res.redirect('/'+command);
    }

    publicFiles = commands[command].public;

    // Allow log files to be viewed too
    publicFiles.push(path.basename(commands[command].stdoutFile));
    publicFiles.push(path.basename(commands[command].stderrFile));

    if (publicFiles.indexOf(file) < 0) {
      req.flash('error', { msg: 'Undefined file!' });
      return res.redirect('/'+command);
    }

    // Absolute final fullpath
    filepath = path.resolve(commands[command].fullpath, file);

    res.set({'Content-type':'text/plain'});
    fs.stat(filepath, function(err, stats){
      if (err) return res.send('File does not exist');
      res.sendFile(filepath);
    });
  });
};

/**
 * POST /:command
 *
 * Actual command execution and spawn()
 */
exports.launch = function(req, res) {
  var command = req.params.command,
      fs = require('fs'),
      path = require('path'),
      spawn = require('child_process').spawn,
      commandArgs,
      child,
      stdout, stderr;

  exports.getCommandsList(function(err, commands){
    var errors = [];

    if (err) {
      req.flash('error', { msg: err.message });
      return res.redirect('/');
    }

    if (!commands[command]) {
      req.flash('error', { msg: 'Undefined command!' });
      return res.redirect('/');
    }

    command = commands[command];
    command.isRunning = exports.isRunning(command.lockFile);

    if (command.isRunning) {
      req.flash('error', { msg: 'Command is currently executing' });
      return res.redirect('/'+req.params.command);
    }

    // Iterate over inputs and ensure that everything is filled
    _.each(command.inputs, function(input, key){
      var inputname = input.inputname,
          file;

      if (input.type == 'file') {
        _.each(req.files, function(req_file){
          if (req_file.fieldname == inputname) {
            file = req_file;
          }
        });

        if (file) {
          fs.renameSync(file.path, path.join(command.fullpath, input.filename));
        } else {
          errors.push({msg: 'Failed to upload '+input.name});
        }
      } else {
        if (!req.body[inputname]) {
          errors.push({msg: 'Empty '+input.name});
        }
      }
    });

    if (errors && errors.length) {
      req.flash('error', errors);
      return res.redirect('/'+req.params.command);
    }

    // Truncate log files
    fs.writeFileSync(command.stdoutFile, '');
    fs.writeFileSync(command.stderrFile, '');

    // Create log file streams
    stdout = fs.createWriteStream(command.stdoutFile, {flags: 'a'});
    stderr = fs.createWriteStream(command.stderrFile, {flags: 'a'});

    commandArgs = exports.formatCommandArgs(command.args, command.inputs, req.body);
    console.log('Launching', command.command, commandArgs);

    // Spawn new child and attach log files
    child = spawn(command.command, commandArgs, {
      cwd: command.cwd || command.fullpath
    });

    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);

    // Save pid to know whenever command is currently executing
    fs.writeFileSync(command.lockFile, child.pid);

    child.on('error', function(data) {
      console.log('error', data);
    });

    // After finishing the process lets delete the log file too
    child.on('close', function(code) {
      console.log('closing code: ' + code);
      fs.unlinkSync(command.lockFile);
    });

    // Command is started, everything should be ok now
    req.flash('success', {msg: 'Execution started!'});
    return res.redirect('/'+req.params.command);
  });
};

/**
 * Returns object of available commands
 * command_dirname => command name
 */
exports.getCommandsList = function(done) {
  var glob = require('glob'),
      fs = require('fs'),
      path = require('path'),
      commands = {},
      config, i, command_key;

  // Iterate over all the directories and make commands list
  glob('bin/*/', function(err, files){
    if (err) return done(err);

    if (files) {
      for (i=0; i<files.length; i++) {
        try {
          // Every directory must have config.json file
          config = JSON.parse(fs.readFileSync(files[i]+'config.json', 'utf8'));

          // Command key will be directory name
          command_key = files[i].substr(0, files[i].length-1).substr(4).replace(/[^A-Za-z0-9\-]/g, '_');

          config.fullpath = exports.getCommandFullDir(command_key);

          // Working directory of spawn process
          if (config.cwd) {
            config.cwd = path.join(config.fullpath, config.cwd);
          }

          // Joined command for user interface
          config.cmd = config.command+' '+config.args.join(' ');

          // Couple of log/lock files
          config.lockFile = path.resolve(config.fullpath, '.lock');
          config.stdoutFile = path.resolve(config.fullpath, 'stdout.log');
          config.stderrFile = path.resolve(config.fullpath, 'stderr.log');

          // Iterate over the inputs and generate unique input names
          _.each(config.inputs, function(input, key){
            if (!input.inputname) {
              config.inputs[key].inputname = input.name.toLowerCase().replace(/[^a-z0-9\-]/g, '_')+key.toString();
            }
          });

          // export all the commands
          commands[command_key] = config;

        } catch (err) {
          if (err.code != 'ENOENT') {
            return done(err);
          }
        }
      }

      done(null, commands);
    }
  });
};

// Get the absolute/fullpath directory of the command directory
exports.getCommandFullDir = function(command_directory) {
   var path = require('path');
   return path.resolve(path.dirname(__dirname), 'bin', command_directory);
};

// Returns whenever process is truly running
exports.isRunning = function(lockFile) {
    var isRunning = null,
        fs = require('fs');

    try {
      if (fs.statSync(lockFile)) {
        isRunning = fs.readFileSync(lockFile, 'utf8');

        // Check whenever process is truly running
        if (isRunning && !require('is-running')(isRunning)) {
          // Unlink the file if there is no running process
          fs.unlinkSync(lockFile);
          isRunning = false;
        }
      }
    } catch(err) {
      console.error(err);
      isRunning = null;
    }

    return isRunning;
};

// Merges command arguments with input data
exports.formatCommandArgs = function (args, inputs, body) {
    _.each(inputs, function(input, key){
      if (input.argname) {
        args = _.map(args, function(arg){
          return arg.replace(new RegExp('%'+input.argname+'%', 'i'), (body[input.inputname] || ''));
        });
      }
    });

    return args;
};
