import { readFileSync } from "node:fs";
import resolve from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";
import svelte from "rollup-plugin-svelte";
import { formatDiagnosticsSummary } from "./diagnostics";
import { type ComponentApiFile, type DiffResult, diffComponentApi, formatDiffReport } from "./diff";
import { getSvelteEntry } from "./get-svelte-entry";
import { loadConfig, mergeConfig } from "./load-config";
import { generateBundle, type PluginSveldOptions, toGenerateBundleOptions, writeOutput } from "./plugin";

/** CLI options layered on top of the shared plugin options. */
interface CliOptions extends PluginSveldOptions {
  /** Set exit code 1 when diagnostics are present. */
  strict?: boolean;
}

function parseCliFlag(arg: string): Partial<CliOptions> {
  if (!arg.startsWith("--")) {
    return {};
  }

  const eqIndex = arg.indexOf("=");
  const flag = eqIndex === -1 ? arg.slice(2) : arg.slice(2, eqIndex);
  const value = eqIndex === -1 ? true : arg.slice(eqIndex + 1);

  switch (flag) {
    case "glob":
    case "types":
    case "json":
    case "markdown":
    case "strict":
    case "resolveTypes":
      return { [flag]: value === true || value === "true" };
    case "fail-fast":
      return { failFast: value === true || value === "true" };
    case "entry":
      return typeof value === "string" ? { entry: value } : {};
    default:
      return {};
  }
}

export function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (const arg of argv) {
    Object.assign(options, parseCliFlag(arg));
  }

  return options;
}

/** Severity level at which the `diff` subcommand exits non-zero. */
type DiffFailOn = "breaking" | "additive" | "none";

interface DiffCliOptions {
  oldPath?: string;
  newPath?: string;
  json: boolean;
  failOn: DiffFailOn;
  detectRenames: boolean;
}

function parseDiffArgs(argv: string[]): DiffCliOptions {
  const options: DiffCliOptions = {
    json: false,
    failOn: "breaking",
    detectRenames: true,
  };
  const positionals: string[] = [];

  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--no-rename-detection") {
      options.detectRenames = false;
    } else if (arg === "--no-fail-on-breaking" || arg === "--no-fail") {
      options.failOn = "none";
    } else if (arg.startsWith("--fail-on=")) {
      const value = arg.slice("--fail-on=".length);
      if (value === "breaking" || value === "additive" || value === "none") {
        options.failOn = value;
      } else {
        throw new Error(`Invalid --fail-on value "${value}". Expected: breaking, additive, or none.`);
      }
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown flag "${arg}" for "sveld diff".`);
    } else {
      positionals.push(arg);
    }
  }

  options.oldPath = positionals[0];
  options.newPath = positionals[1];
  return options;
}

function readComponentApi(filePath: string): ComponentApiFile {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`Could not read "${filePath}".`);
  }
  try {
    return JSON.parse(raw) as ComponentApiFile;
  } catch {
    throw new Error(`"${filePath}" is not valid JSON.`);
  }
}

function shouldFail(result: DiffResult, failOn: DiffFailOn): boolean {
  if (failOn === "none") return false;
  if (failOn === "additive") return result.summary.breaking + result.summary.additive > 0;
  return result.hasBreaking;
}

/**
 * Runs `sveld diff <old.json> <new.json>`: compares two `COMPONENT_API.json`
 * snapshots, prints a report (human-readable or `--json`), and returns the
 * process exit code (non-zero when failing changes are present).
 */
export function diffCli(process: NodeJS.Process): number {
  const options = parseDiffArgs(process.argv.slice(3));

  if (!options.oldPath || !options.newPath) {
    process.stderr.write(
      "Usage: sveld diff <old.json> <new.json> [--json] [--fail-on=breaking|additive|none] [--no-rename-detection]\n",
    );
    return 2;
  }

  const oldApi = readComponentApi(options.oldPath);
  const newApi = readComponentApi(options.newPath);
  const result = diffComponentApi(oldApi, newApi, { detectRenames: options.detectRenames });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatDiffReport(result)}\n`);
  }

  return shouldFail(result, options.failOn) ? 1 : 0;
}

/**
 * CLI entry point: parse flags, load any config file, run Rollup, generate
 * docs, write outputs.
 *
 * Dispatches to the `diff` subcommand when invoked as `sveld diff ...`.
 *
 * @example
 * ```ts
 * // Called from CLI: sveld --types --json --glob
 * // Parses: { types: true, json: true, glob: true }
 * ```
 */
export async function cli(process: NodeJS.Process) {
  if (process.argv[2] === "diff") {
    try {
      process.exitCode = diffCli(process);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    }
    return;
  }

  const cliOptions = parseCliOptions(process.argv.slice(2));
  const fileConfig = await loadConfig();
  const options = mergeConfig<CliOptions>(fileConfig, cliOptions);

  const input = getSvelteEntry(options.entry) || "src/index.js";
  const rollup_bundle = await rollup({
    input,
    plugins: [svelte(), resolve()],
  });

  await rollup_bundle.generate({});

  const result = await generateBundle(input, options.glob === true, toGenerateBundleOptions(options));

  writeOutput(result, options, input);

  const { diagnostics } = result;
  console.log(formatDiagnosticsSummary(diagnostics));

  if (options.strict && diagnostics.length > 0) {
    process.exitCode = 1;
  }
}
