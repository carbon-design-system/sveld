#!/usr/bin/env node

// biome-ignore lint/performance/noNamespaceImport: a named import of enableCompileCache fails to link on Node < 22.1.
import * as nodeModule from "node:module";

// Caches V8's compiled bytecode for sveld's own modules across runs (Node
// 22.1+; a no-op on older Node and Bun), so startup skips recompiling them.
nodeModule.enableCompileCache?.();

import("./cli-entry.js")
  .then(({ cli }) => cli(process))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
