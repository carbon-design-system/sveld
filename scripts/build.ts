import { watch } from "node:fs";
import { $, build } from "bun";

const isWatchMode = process.argv.includes("-w") || process.argv.includes("--watch");

await $`rm -rf lib; mkdir lib`;

async function emitTypeDeclarations() {
  const result = await $`tsc --project tsconfig.build.json`.quiet();
  if (result.exitCode !== 0) {
    console.error(result.stderr.toString());
    if (!isWatchMode) {
      process.exit(1);
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
    // Default Bun behavior treats `node_modules` imports as external; bundle
    // them so `svelte/compiler` (and `estree-walker`) ship inside `lib`.
    packages: "bundle",
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
