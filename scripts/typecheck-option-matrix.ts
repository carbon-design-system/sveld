/**
 * Typechecks every fixture's generated `.d.ts` under a curated matrix of
 * `typesOptions` combinations.
 *
 * `bun run test:fixtures-types` only checks the committed default-options
 * outputs. Typechecking generated output is what surfaced the worst `.d.ts`
 * bugs (a default value closing its JSDoc comment early, `typeNames`
 * duplicate identifiers, undeclared module-script types), so this covers
 * the rest of the option surface consumers actually use.
 *
 * Each option set gets its own directory, `<tmp>/<set>/<fixture>/`, holding
 * the component's `.d.ts` plus the fixture's sibling `.ts` / `.d.ts` files
 * (e.g. `module-script-types/base.d.ts`) so relative imports resolve. Then
 * one `tsc` (TypeScript 7) runs per set, all sets in parallel. The temp dir
 * lives inside the repo so `moduleResolution: "bundler"` finds the repo's
 * own `node_modules/svelte`.
 *
 * The matrix is representative, not the cartesian product: every emit
 * option at a non-default value at least once, plus one risky combination.
 * `inline` and `transform` aren't covered: `inline` needs a full bundle
 * (`generateBundle`) to resolve imports, and `transform` is consumer code.
 *
 * Usage:
 *   bun run test:types-matrix
 *   bun run test:types-matrix --keep   # keep the temp dir for inspection
 *
 * Exits non-zero when any option set fails to typecheck.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { asNormalizedPath } from "../src/brands";
import ComponentParser from "../src/ComponentParser";
import type { ComponentDocApi } from "../src/plugin";
import { type WriteTsDefinitionOptions, writeTsDefinition } from "../src/writer/writer-ts-definitions-core";

const REPO_ROOT = path.join(import.meta.dir, "..");
const FIXTURES_DIR = path.join(REPO_ROOT, "tests", "fixtures");
const FIXTURES_TSCONFIG = path.join(REPO_ROOT, "tsconfig.fixtures.json");

/** Committed fixture outputs (`output-class.d.ts`, ...), regenerated per set instead of copied. */
const COMMITTED_OUTPUT_REGEX = /^output/;
/** Sibling type sources a generated `.d.ts` may import (`./types`, `./base.js`, `./Button.svelte`). */
const TS_SOURCE_REGEX = /\.ts$/;
/**
 * An import of a committed output (`from "./output-class"`). Such a sibling is
 * a consumer-side check of the default output (`context-module/types.ts`),
 * not a dependency of the `.d.ts`, so it's left out.
 */
const IMPORTS_COMMITTED_OUTPUT_REGEX = /from\s+["']\.\/output/;
/** Windows path separators, for the `extends` path in a generated tsconfig. */
const BACKSLASH_REGEX = /\\/g;

export interface OptionSet {
  /** Directory name for the set; shows up in `tsc` error paths. */
  name: string;
  options: WriteTsDefinitionOptions;
}

export const OPTION_MATRIX: OptionSet[] = [
  { name: "class", options: { format: "class" } },
  { name: "component", options: { format: "component" } },
  { name: "export-types-none", options: { exportTypes: false } },
  { name: "export-types-partial", options: { exportTypes: { props: false, typedefs: false } } },
  { name: "type-names", options: { typeNames: { props: "{name}PropsT", exports: "{name}ExportsT" } } },
  { name: "comments-none", options: { comments: "none" } },
  { name: "props-interface", options: { propsDeclaration: "interface" } },
  {
    name: "component-interface-private-descriptions",
    options: { format: "component", exportTypes: false, propsDeclaration: "interface", comments: "descriptions" },
  },
];

export interface SetResult {
  name: string;
  ok: boolean;
  /** `tsc` stdout + stderr; paths are relative to the set's directory. */
  output: string;
  ms: number;
}

export interface MatrixResult {
  sets: SetResult[];
  failures: SetResult[];
  fixtureCount: number;
  /** Wall-clock milliseconds per phase. */
  timings: { parse: number; write: number; tsc: number };
}

export interface RunOptionMatrixOptions {
  /** Fixture directory names to check. Defaults to every fixture. */
  fixtures?: string[];
  sets?: OptionSet[];
  /** Swappable so tests can prove a broken writer path is caught. */
  write?: (component: ComponentDocApi, options: WriteTsDefinitionOptions) => string;
  /** Keep the temp dir instead of deleting it. */
  keep?: boolean;
}

interface Fixture {
  dir: string;
  component: ComponentDocApi;
  siblings: string[];
}

/** Same `moduleName` derivation as `tests/fixtures.test.ts`: kebab-case dir to PascalCase. */
function toModuleName(dir: string): string {
  return dir
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

async function loadFixtures(names?: string[]): Promise<Fixture[]> {
  const dirs =
    names ??
    readdirSync(FIXTURES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  const parser = new ComponentParser();

  const loaded = await Promise.all(
    dirs.map(async (dir) => {
      const file = Bun.file(path.join(FIXTURES_DIR, dir, "input.svelte"));
      if (!(await file.exists())) return null;
      const source = await file.text();
      const filePath = `${dir}/input.svelte`;
      const moduleName = toModuleName(dir);
      const parsed = parser.parseSvelteComponent(source, { filePath, moduleName });
      const siblings = readdirSync(path.join(FIXTURES_DIR, dir)).filter(
        (name) =>
          TS_SOURCE_REGEX.test(name) &&
          !COMMITTED_OUTPUT_REGEX.test(name) &&
          !IMPORTS_COMMITTED_OUTPUT_REGEX.test(readFileSync(path.join(FIXTURES_DIR, dir, name), "utf8")),
      );
      const component: ComponentDocApi = { moduleName, filePath: asNormalizedPath(filePath), ...parsed };
      return { dir, component, siblings };
    }),
  );
  return loaded.filter((fixture) => fixture !== null);
}

function resolveTscBin(): string {
  // TypeScript 7 (native), not the `tsc` on PATH (TypeScript 6 via
  // `@typescript/old`): about 0.4s for all fixtures instead of about 3s.
  const packageJson = Bun.resolveSync("typescript/package.json", REPO_ROOT);
  return path.join(path.dirname(packageJson), "bin", "tsc");
}

function writeSet(setDir: string, set: OptionSet, fixtures: Fixture[], write: RunOptionMatrixOptions["write"]) {
  const emit = write ?? writeTsDefinition;
  for (const { dir, component, siblings } of fixtures) {
    const fixtureDir = path.join(setDir, dir);
    mkdirSync(fixtureDir, { recursive: true });
    writeFileSync(path.join(fixtureDir, "input.svelte.d.ts"), emit(component, set.options));
    for (const sibling of siblings) {
      copyFileSync(path.join(FIXTURES_DIR, dir, sibling), path.join(fixtureDir, sibling));
    }
  }
  // Extend the committed fixtures config so both checks share compiler options.
  const tsconfig = {
    extends: path.relative(setDir, FIXTURES_TSCONFIG).replace(BACKSLASH_REGEX, "/"),
    include: ["**/*.ts"],
  };
  writeFileSync(path.join(setDir, "tsconfig.json"), `${JSON.stringify(tsconfig, null, 2)}\n`);
}

async function typecheckSet(tscBin: string, setDir: string, name: string): Promise<SetResult> {
  const start = performance.now();
  // One single-threaded tsc per set, all at once, beat one multi-threaded tsc
  // per set run in turn: tsc phase median 1.8s vs 3.1s (7 interleaved runs).
  const proc = Bun.spawn({
    cmd: [process.execPath, tscBin, "--noEmit", "--pretty", "false", "--singleThreaded", "-p", "tsconfig.json"],
    cwd: setDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { name, ok: exitCode === 0, output: `${stdout}${stderr}`.trim(), ms: performance.now() - start };
}

export async function runOptionMatrix(options: RunOptionMatrixOptions = {}): Promise<MatrixResult> {
  const sets = options.sets ?? OPTION_MATRIX;
  const t0 = performance.now();
  const fixtures = await loadFixtures(options.fixtures);
  const tmpDir = mkdtempSync(path.join(REPO_ROOT, ".tmp-sveld-types-matrix-"));
  try {
    const t1 = performance.now();
    for (const set of sets) writeSet(path.join(tmpDir, set.name), set, fixtures, options.write);
    const t2 = performance.now();
    const tscBin = resolveTscBin();
    const results = await Promise.all(sets.map((set) => typecheckSet(tscBin, path.join(tmpDir, set.name), set.name)));
    const t3 = performance.now();
    return {
      sets: results,
      failures: results.filter((result) => !result.ok),
      fixtureCount: fixtures.length,
      timings: { parse: t1 - t0, write: t2 - t1, tsc: t3 - t2 },
    };
  } finally {
    if (options.keep) console.log(`Kept ${tmpDir}`);
    else rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const start = performance.now();
  const result = await runOptionMatrix({ keep: process.argv.includes("--keep") });
  for (const set of result.sets) {
    console.log(`${set.ok ? "ok  " : "FAIL"} ${set.name} (${Math.round(set.ms)}ms)`);
  }
  for (const failure of result.failures) {
    console.error(`\n[${failure.name}] ${JSON.stringify(OPTION_MATRIX.find((s) => s.name === failure.name)?.options)}`);
    console.error(failure.output);
  }
  const total = Math.round(performance.now() - start);
  const { parse, write, tsc } = result.timings;
  console.log(
    `\n${result.fixtureCount} fixtures x ${result.sets.length} option sets in ${total}ms ` +
      `(parse ${Math.round(parse)}ms, write ${Math.round(write)}ms, tsc ${Math.round(tsc)}ms)`,
  );
  if (result.failures.length > 0) process.exit(1);
}
