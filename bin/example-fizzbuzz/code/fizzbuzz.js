#!/usr/bin/env node

// Do not forget to do npm install first on this file folder

var argv = require('yargs').argv,
    verbose = !!(argv.verbose),
    fizz = argv.fizz || 'Fizz',
    buzz = argv.buzz || 'Buzz',
    i;

if (verbose) {
  console.log('Using', fizz, 'for fizz');
  console.log('Using', buzz, 'for buzz');
}

for (i=1; i<100; i++) {
  console.log((i%3 ? '' : fizz) + (i%5 ? '' : buzz) || i);
}

process.exit();
