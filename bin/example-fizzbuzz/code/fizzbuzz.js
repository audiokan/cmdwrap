#!/usr/bin/env node

var argv = require('yargs').argv,
    fizz = argv.fizz || 'Fizz',
    buzz = argv.buzz || 'Buzz',
    i;

for (var i=1; i<100; i++) {
  console.log((i%3 ? '' : fizz) + (i%5 ? '' : buzz) || i);
}

process.exit();
