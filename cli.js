#!/usr/bin/env node

(() => {
  try {
    require("./lib").cli(process);
  } catch (error) {
    process.stderr.write(error + "\n");
  }
})();
