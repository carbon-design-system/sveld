#!/usr/bin/env node

import("./lib/cli-entry.js")
  .then(({ cli }) => cli(process))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
