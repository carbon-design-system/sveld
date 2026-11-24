// Runs the e2e projects against the build in `dist/`.
// @depends-on scripts/build.ts
// @reads tests/e2e/**
import { readdirSync, rmSync } from "node:fs";
import { availableParallelism } from "node:os";
import { basename, join } from "node:path";
import { $ } from "bun";
import { name } from "../package.json";

// `bun link` registers the package in one global directory, and links its
// bin into the global bin directory, so two checkouts running e2e (e.g.
// parallel worktrees) would link each other's build, and the second would
// fail on the bin with EEXIST. Keep both inside this checkout. The e2e
// projects run sveld from their own node_modules/.bin, never the global one.
const linkDir = join(import.meta.dir, "..", "node_modules", ".cache", "e2e-link");
$.env({
  ...process.env,
  BUN_INSTALL_GLOBAL_DIR: process.env.BUN_INSTALL_GLOBAL_DIR ?? linkDir,
  BUN_INSTALL_BIN: process.env.BUN_INSTALL_BIN ?? join(linkDir, "bin"),
});

// Link the built `dist/`, the same tree that gets published.
await $`cd dist && bun link`;

let hasError = false;

/** `--only <name>` (or `--only=<name>`) restricts the run to one e2e project by directory name. */
const onlyIndex = process.argv.indexOf("--only");
const only =
  onlyIndex === -1
    ? process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length)
    : process.argv[onlyIndex + 1];

const e2eRoot = "tests/e2e";
const dirs = readdirSync(e2eRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => only === undefined || entry.name === only)
  .map((entry) => join(e2eRoot, entry.name));

if (only !== undefined && dirs.length === 0) {
  console.error(`--only "${only}" matched no directory under ${e2eRoot}.`);
  process.exit(1);
}

/** One step of a `package.json#e2e.scripts` entry; see `runE2eScripts`. */
interface E2eScriptStep {
  script: string;
  /** Defaults to 0. */
  expectExitCode?: number;
  /** Asserts stdout is a single JSON document. */
  expectStdout?: "json";
}

/**
 * A project's output and failures, kept until the project finishes so
 * projects running at the same time don't interleave their logs.
 */
interface ProjectLog {
  dir: string;
  output: string[];
  errors: string[];
}

/** Runs `bun run <script>` in the project, recording its output. Never throws. */
async function runScript(log: ProjectLog, script: string) {
  log.output.push(`$ bun run ${script}`);
  const result = await $`cd ${log.dir} && bun run ${script}`.quiet().nothrow();
  for (const stream of [result.stdout, result.stderr]) {
    const text = stream.toString().trimEnd();
    if (text) log.output.push(text);
  }
  return result;
}

/**
 * Runs a project's `package.json#e2e.scripts` in order, each against its own
 * expected exit code and (optionally) stdout shape, instead of the single
 * always-exit-0 script the rest of this file assumes. Opt-in via an `e2e`
 * field so existing single-script projects are unaffected.
 */
async function runE2eScripts(log: ProjectLog, steps: E2eScriptStep[]) {
  for (const step of steps) {
    // Steps mutate shared on-disk state (snapshots, cache) and must run in order.
    const result = await runScript(log, step.script);
    const expectedExitCode = step.expectExitCode ?? 0;

    if (result.exitCode !== expectedExitCode) {
      log.errors.push(`"${step.script}" exited ${result.exitCode}, expected ${expectedExitCode}`);
      continue;
    }

    if (step.expectStdout === "json") {
      try {
        JSON.parse(result.stdout.toString());
      } catch {
        log.errors.push(`"${step.script}" stdout is not valid JSON`);
      }
    }
  }
}

/** Generates the project's docs and types, then checks them. */
async function checkProject(log: ProjectLog) {
  const pkg = await Bun.file(`${log.dir}/package.json`).json();

  if (pkg.e2e?.scripts) {
    await runE2eScripts(log, pkg.e2e.scripts);
    return;
  }

  const script = pkg.scripts?.sveld ? "sveld" : "build";
  if (!pkg.scripts?.[script]) {
    log.errors.push(`missing "${script}" script`);
    return;
  }

  if ((await runScript(log, script)).exitCode !== 0) {
    log.errors.push(`${script} failed`);
    return;
  }

  if (pkg.scripts.typecheck && (await runScript(log, "typecheck")).exitCode !== 0) {
    log.errors.push("typecheck failed");
  }

  // Consumer components under `test/` checked against the generated types,
  // unless the project's own script already ran svelte-check.
  if (pkg.scripts["svelte-check"] && !pkg.scripts[script].includes("svelte-check")) {
    if ((await runScript(log, "svelte-check")).exitCode !== 0) log.errors.push("svelte-check failed");
  }
}

// Slowest first, so they start before the rest: carbon is the largest, and
// the Vite projects run full builds.
const SLOW_FIRST = ["carbon", "sveltekit", "svelte5-vite"];
const rank = (dir: string) => {
  const index = SLOW_FIRST.indexOf(basename(dir));
  return index === -1 ? SLOW_FIRST.length : index;
};
const inCI = process.env.GITHUB_ACTIONS === "true";

/** Checks one project and prints its log as one block. */
async function checkAndReport(dir: string) {
  const log: ProjectLog = { dir, output: [], errors: [] };
  const start = performance.now();
  await checkProject(log).catch((error) => log.errors.push(String(error)));
  const seconds = ((performance.now() - start) / 1000).toFixed(1);
  const failed = log.errors.length > 0;

  // A passing project's log folds away in CI; a failing one stays open.
  const header = `${dir} ${failed ? "failed" : "passed"} in ${seconds}s`;
  console.log(inCI && !failed ? `::group::${header}` : `--- ${header}`);
  console.log(log.output.join("\n"));
  if (inCI && !failed) console.log("::endgroup::");
  for (const error of log.errors) console.error(`${dir}: ${error}`);
  if (failed) hasError = true;
}

const limit = availableParallelism();
let running = 0;
const waiting: (() => void)[] = [];

/** Runs `task` once fewer than one check per core is running. */
async function whenFree(task: () => Promise<void>) {
  while (running >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const checks: Promise<void>[] = [];

// Linking and installing go through one bun link registry, so they run one
// project at a time. A project's checks only touch that project, so each
// starts as soon as its install is done, alongside the next installs.
for (const dir of dirs.toSorted((a, b) => rank(a) - rank(b))) {
  if (!(await Bun.file(`${dir}/package.json`).exists())) continue;

  rmSync(join(dir, "types"), { recursive: true, force: true });
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith("types-")) {
      rmSync(join(dir, entry), { recursive: true, force: true });
    }
  }
  await $`cd ${dir} && bun link ${name}`;
  await $`cd ${dir} && bun install`;
  checks.push(whenFree(() => checkAndReport(dir)));
}

await Promise.all(checks);

// Smoke-test the published bin shim: a config file that throws while
// loading must exit non-zero (see the launcher's rejection handler), otherwise
// CI gates using --strict or --check would pass silently on a crash.
const cliPath = `${import.meta.dir}/../dist/cli.js`;
const crashResult = Bun.spawnSync(["node", cliPath], {
  cwd: `${import.meta.dir}/e2e/cli-crash`,
  stdout: "pipe",
  stderr: "pipe",
});
const crashStderr = crashResult.stderr.toString();

if (crashResult.exitCode !== 2 || !crashStderr.includes("sveld.config.js")) {
  console.error("CLI crash smoke test failed. exitCode:", crashResult.exitCode, "stderr:", crashStderr);
  hasError = true;
}

if (hasError) {
  process.exit(1);
}
