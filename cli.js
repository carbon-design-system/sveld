#!/usr/bin/env node

(() => {
  try {
    require("./lib").cli(process);
  } catch (error) {
    console.error(error);
  }
})();
