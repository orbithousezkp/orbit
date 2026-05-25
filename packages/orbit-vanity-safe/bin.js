#!/usr/bin/env node
'use strict';

const { main } = require('./src/cli');

main(process.argv.slice(2))
  .then((code) => {
    process.exit(typeof code === 'number' ? code : 0);
  })
  .catch((err) => {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(2);
  });
