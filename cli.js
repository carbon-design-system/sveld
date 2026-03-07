#!/usr/bin/env node

import("./lib/index.js").then(({ cli }) => cli(process)).catch(console.error);
