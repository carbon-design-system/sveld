import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { name } from "../package.json";

await $`bun link`;

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
  /** Asserts stdout is a single JSON document, or one JSON object per non-empty line. */
  expectStdout?: "json" | "ndjson";
  /** With `expectStdout: "ndjson"`, the exact number of JSON lines expected. */
  expectLines?: number;
}

/**
 * Runs a project's `package.json#e2e.scripts` in order, each against its own
 * expected exit code and (optionally) stdout shape, instead of the single
 * always-exit-0 script the rest of this file assumes. Opt-in via an `e2e`
 * field so existing single-script projects are unaffected.
 */
async function runE2eScripts(dir: string, steps: E2eScriptStep[]): Promise<boolean> {
  let ok = true;

  for (const step of steps) {
    // biome-ignore lint/performance/noAwaitInLoops: steps mutate shared on-disk state (snapshots, cache) and must run in order.
    const result = await $`cd ${dir} && bun run ${step.script}`.nothrow();
    const expectedExitCode = step.expectExitCode ?? 0;

    if (result.exitCode !== expectedExitCode) {
      console.error(`${dir}: "${step.script}" exited ${result.exitCode}, expected ${expectedExitCode}`);
      ok = false;
      continue;
    }

    if (step.expectStdout === "json") {
      try {
        JSON.parse(result.stdout.toString());
      } catch {
        console.error(`${dir}: "${step.script}" stdout is not valid JSON`);
        ok = false;
      }
    }

    if (step.expectStdout === "ndjson") {
      const lines = result.stdout
        .toString()
        .split("\n")
        .filter((line) => line.length > 0);

      if (step.expectLines !== undefined && lines.length !== step.expectLines) {
        console.error(`${dir}: "${step.script}" printed ${lines.length} ndjson lines, expected ${step.expectLines}`);
        ok = false;
      }

      for (const line of lines) {
        try {
          JSON.parse(line);
        } catch {
          console.error(`${dir}: "${step.script}" printed a non-JSON ndjson line: ${line}`);
          ok = false;
        }
      }
    }
  }

  return ok;
}

for (const dir of dirs) {
  const packageJsonPath = `${dir}/package.json`;
  // biome-ignore lint/performance/noAwaitInLoops: each example links/installs/builds into a shared bun link registry, so they must run one at a time.
  if (!(await Bun.file(packageJsonPath).exists())) continue;

  try {
    rmSync(join(dir, "types"), { recursive: true, force: true });
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith("types-")) {
        rmSync(join(dir, entry), { recursive: true, force: true });
      }
    }
    await $`cd ${dir} && bun link ${name}`;
    await $`cd ${dir} && bun install`;

    const pkg = await Bun.file(packageJsonPath).json();

    if (pkg.e2e?.scripts) {
      if (!(await runE2eScripts(dir, pkg.e2e.scripts))) hasError = true;
      continue;
    }

    const script = pkg.scripts?.sveld ? "sveld" : "build";
    if (!pkg.scripts?.[script]) {
      console.error(`Missing "${script}" script in ${dir}`);
      hasError = true;
      continue;
    }

    const result = await $`cd ${dir} && bun run ${script}`;

    if (result.exitCode !== 0) {
      console.error(`${script} failed in ${dir}`);
      hasError = true;
      continue;
    }

    if (pkg.scripts?.typecheck) {
      const typecheck = await $`cd ${dir} && bun run typecheck`;
      if (typecheck.exitCode !== 0) {
        console.error(`typecheck failed in ${dir}`);
        hasError = true;
      }
    }
  } catch (error) {
    console.error(`Error in ${dir}:`, error);
    hasError = true;
  }
}

// Smoke-test the published bin shim: a config file that throws while
// loading must exit non-zero (see cli.js's rejection handler), otherwise
// CI gates using --strict or --check would pass silently on a crash.
const cliPath = `${import.meta.dir}/../cli.js`;
const crashResult = Bun.spawnSync(["node", cliPath], {
  cwd: `${import.meta.dir}/e2e/cli-crash`,
  stdout: "pipe",
  stderr: "pipe",
});
const crashStderr = crashResult.stderr.toString();

if (crashResult.exitCode !== 1 || !crashStderr.includes("sveld.config.js")) {
  console.error("CLI crash smoke test failed. exitCode:", crashResult.exitCode, "stderr:", crashStderr);
  hasError = true;
}

if (hasError) {
  process.exit(1);
}
