#!/usr/bin/env node

import("./lib/index.js")
  .then(({ cli }) => cli(process))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
