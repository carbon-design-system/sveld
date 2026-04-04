import { watch } from "node:fs";
import { $, build } from "bun";

const isWatchMode = process.argv.includes("-w") || process.argv.includes("--watch");

await $`rm -rf lib; mkdir lib`;

async function emitTypeDeclarations() {
  try {
    const ts = await import("typescript");
    const configPath = ts.findConfigFile(".", ts.sys.fileExists, "tsconfig.build.json");

    if (!configPath) {
      throw new Error("Could not find tsconfig.build.json");
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(`Failed to read tsconfig: ${ts.formatDiagnostic(configFile.error, ts.createCompilerHost({}))}`);
    }

    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, "./");

    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    const emitResult = program.emit();
    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    if (allDiagnostics.length > 0) {
      const host = ts.createCompilerHost(parsedConfig.options);
      for (const diagnostic of allDiagnostics) {
        console.error(ts.formatDiagnostic(diagnostic, host));
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
  }
}

async function buildProject() {
  const result = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./lib",
    format: "esm",
    target: "node",
    minify: true,
    sourcemap: false,
    external: [
      // Svelte compiler is large (~4MB+ bundled). Externalize; consumers have it.
      "svelte",
      // Peer dependency; avoids bundling css-tree/mdn-data which use
      // createRequire with relative paths for JSON data files.
      // Uses dynamic requires for internal data files that break when bundled.
      "prettier",
      // Native module used by rollup's file watcher (not needed at runtime).
      "fsevents",
    ],
  });

  if (!result.success) {
    console.error("Build failed");
    for (const log of result.logs) {
      console.error(log);
    }
    if (!isWatchMode) {
      process.exit(1);
    }
    return;
  }

  await emitTypeDeclarations();
  console.log("✓ Build completed");
}

if (isWatchMode) {
  console.log("Watching for changes...\n");

  await buildProject();

  let debounceTimer: Timer | null = null;
  let isBuilding = false;

  const watcher = watch("./src", { recursive: true }, (_eventType, filename) => {
    if (filename && !isBuilding) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        console.log(`\nFile changed: ${filename}`);
        isBuilding = true;
        await buildProject();
        isBuilding = false;
      }, 100);
    }
  });

  setInterval(() => {}, 1000);

  process.on("SIGINT", () => {
    console.log("\nStopping watch mode...");
    watcher.close();
    process.exit(0);
  });
} else {
  await buildProject();
}
