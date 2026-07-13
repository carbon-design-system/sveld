import { watch } from "node:fs";
import { resolve } from "node:path";
import { $, build } from "bun";
import { bundleDts } from "./bundle-dts";

const isWatchMode = process.argv.includes("-w") || process.argv.includes("--watch");
const root = process.cwd();

await $`rm -rf lib; mkdir lib`;

async function emitTypeDeclarations() {
  try {
    await bundleDts({
      root,
      entries: [
        { name: "index", source: resolve(root, "src/index.ts"), outFile: resolve(root, "lib/index.d.ts") },
        { name: "browser", source: resolve(root, "src/browser.ts"), outFile: resolve(root, "lib/browser.d.ts") },
      ],
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    if (!isWatchMode) {
      process.exit(1);
    }
  }
}

async function buildEntry(entrypoints: string[], target: "node" | "browser") {
  const result = await build({
    entrypoints,
    outdir: "./lib",
    format: "esm",
    target,
    minify: true,
    sourcemap: false,
    // Default Bun behavior treats `node_modules` imports as external; bundle
    // them so dependencies (estree-walker, and the pruned svelte parser
    // imported by src/svelte-parse.ts) ship inside `lib`.
    packages: "bundle",
    // Emit the parser stack (behind `./parser-stack`'s dynamic import) as its
    // own chunk instead of inlining it, so a fully cached CLI run never loads it.
    // index.ts and cli-entry.ts share this dynamic import, so building them
    // together lets Bun dedupe the chunk instead of emitting it twice.
    splitting: true,
  });

  if (!result.success) {
    console.error(`Build failed for ${entrypoints.join(", ")}`);
    for (const log of result.logs) {
      console.error(log);
    }
    if (!isWatchMode) {
      process.exit(1);
    }
    return false;
  }

  return true;
}

async function buildProject() {
  const [node, browser] = await Promise.all([
    buildEntry(["./src/index.ts", "./src/cli-entry.ts"], "node"),
    buildEntry(["./src/browser.ts"], "browser"),
  ]);

  if (!node || !browser) return;

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
