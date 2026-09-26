/**
 * Typechecks every legacy fixture's `format: "class"` `.d.ts` against
 * Svelte 3 and Svelte 4, which the README says the default output supports.
 * `test:fixtures-types` and `test:types-matrix` only check against the
 * repo's own Svelte 5.
 *
 * Each version is installed into its own temp dir (outside the repo, so
 * `svelte` resolves there), then the option matrix runs from inside it.
 * Runes fixtures are skipped: runes need Svelte 5.
 *
 * Usage:
 *   bun run test:svelte-versions
 *
 * Exits non-zero when any version fails to typecheck.
 */
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { $ } from "bun";
import { devDependencies } from "../package.json";
import { runOptionMatrix } from "./typecheck-option-matrix";

const SVELTE_VERSIONS = ["3", "4"];

let failed = false;

for (const version of SVELTE_VERSIONS) {
  // Real path: on macOS tmpdir() is a symlink, which breaks the relative
  // `extends` path to the repo's tsconfig.fixtures.json.
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), `sveld-svelte${version}-`)));
  try {
    // `acorn`: the one other package a fixture's `.d.ts` imports (module-reexport).
    const dependencies = { svelte: version, acorn: devDependencies.acorn };
    writeFileSync(path.join(root, "package.json"), `${JSON.stringify({ private: true, dependencies }, null, 2)}\n`);
    // biome-ignore lint/performance/noAwaitInLoops: each version installs into its own dir; two at once only race on bun's cache.
    await $`bun install --silent`.cwd(root);

    const result = await runOptionMatrix({
      root,
      sets: [{ name: `class-svelte${version}`, options: { format: "class" } }],
      filter: (component) => component.syntaxMode !== "runes",
    });

    for (const set of result.sets) {
      console.log(`${set.ok ? "ok  " : "FAIL"} ${set.name}: ${result.fixtureCount} fixtures (${Math.round(set.ms)}ms)`);
      if (!set.ok) {
        console.error(set.output);
        failed = true;
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (failed) process.exit(1);
