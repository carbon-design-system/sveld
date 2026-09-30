import { watch } from "node:fs";
import { chmod, cp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { $, build } from "bun";
import { computeBuildId } from "./build-id";
import { bundleDts } from "./bundle-dts";

const isWatchMode = process.argv.includes("-w") || process.argv.includes("--watch");
const root = process.cwd();
const outDir = resolve(root, "dist");

/** Root-manifest fields that only matter to this repo, not to consumers. */
const STRIP_PKG_FIELDS = ["devDependencies", "scripts", "files"];
const BIN_DIST_PREFIX = /^dist\//;
const DIST_PREFIX = /\.\/dist\//g;

// `dist/` is the package root: it is what gets published, so the tarball has
// no `lib/` (or any other) prefix. Copy the static assets in first, so a
// failed build never leaves a manifest next to missing assets.
await $`rm -rf ${outDir}; mkdir ${outDir}`;
await Promise.all(["README.md", "LICENSE"].map((asset) => cp(resolve(root, asset), resolve(outDir, asset))));
await cp(resolve(root, "schema"), resolve(outDir, "schema"), { recursive: true });
// The bin launcher is hand-written (not bundled) so it can enable Node's compile
// cache before loading `cli-entry.js`.
await cp(resolve(root, "scripts/cli-launcher.js"), resolve(outDir, "cli.js"));
await chmod(resolve(outDir, "cli.js"), 0o755);

/**
 * Writes `dist/package.json`: the root manifest without repo-only fields and
 * with `./dist/*` paths rewritten to `./*` (and `bin` to a bare `cli.js`, which is the form npm wants), so they resolve once `dist/` is
 * the package root. The root manifest stays the single source of truth.
 */
async function writePackageManifest() {
  const pkg = await Bun.file(resolve(root, "package.json")).json();

  for (const field of STRIP_PKG_FIELDS) {
    delete pkg[field];
  }

  // npm wants `bin` paths without a leading "./" (`npm pkg fix` strips it).
  for (const [name, path] of Object.entries(pkg.bin as Record<string, string>)) {
    pkg.bin[name] = path.replace(BIN_DIST_PREFIX, "");
  }

  await writeFile(resolve(outDir, "package.json"), `${JSON.stringify(pkg, null, 2).replace(DIST_PREFIX, "./")}\n`);
}

async function emitTypeDeclarations() {
  try {
    await bundleDts({
      root,
      entries: [
        { name: "index", source: resolve(root, "src/index.ts"), outFile: resolve(root, "dist/index.d.ts") },
        { name: "browser", source: resolve(root, "src/browser.ts"), outFile: resolve(root, "dist/browser.d.ts") },
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
    // Read by `src/parse-cache.ts`: a rebuild from changed sources invalidates the parse cache.
    define: { __SVELD_BUILD_ID__: JSON.stringify(computeBuildId(resolve(root, "src"))) },
    entrypoints,
    outdir: outDir,
    format: "esm",
    target,
    minify: true,
    sourcemap: false,
    // Default Bun treats `node_modules` as external. Bundle them so acorn
    // and `@sveltejs/acorn-typescript` ship inside `dist`.
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
  await writePackageManifest();
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
