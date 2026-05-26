#!/usr/bin/env node
"use strict";
require("./src/index").main(process.argv.slice(2)).catch((error) => {
  console.error(`[create-orbit-house] ${error.message}`);
  process.exit(1);
});
