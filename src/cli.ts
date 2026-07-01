import resolve from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";
import svelte from "rollup-plugin-svelte";
import { type CheckResult, formatCheckReport, runCheck } from "./check";
import { formatDiagnosticsSummary } from "./diagnostics";
import { getSvelteEntry } from "./get-svelte-entry";
import { loadConfig, mergeConfig } from "./load-config";
import { generateBundle, type PluginSveldOptions, toGenerateBundleOptions, writeOutput } from "./plugin";

/** CLI options layered on top of the shared plugin options. */
interface CliOptions extends PluginSveldOptions {
  /** Set exit code 1 when diagnostics are present. */
  strict?: boolean;
  /**
   * Diff the parsed component API against a committed snapshot (default:
   * the `json` writer's `outFile`, or `COMPONENT_API.json`) and assign a
   * semver bump to each change. Exits `1` on a breaking change. Pass a
   * string for a custom snapshot path.
   */
  check?: boolean | string;
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
    case "cache":
      // Bare `--cache` enables the default cache location; `--cache=<path>`
      // overrides it; `--cache=false` disables it.
      if (value === "false") return { cache: false };
      return { cache: typeof value === "string" ? value : true };
    case "check":
      // Bare `--check` diffs against the default snapshot path;
      // `--check=<path>` overrides it; `--check=false` disables it.
      if (value === "false") return { check: false };
      return { check: typeof value === "string" ? value : true };
    default:
      return {};
  }
}

/** Default snapshot path mirrors the `json` writer's default `outFile`. */
function resolveCheckSnapshotFile(options: CliOptions): string {
  if (typeof options.check === "string") return options.check;
  return options.jsonOptions?.outFile ?? "COMPONENT_API.json";
}

export function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (const arg of argv) {
    Object.assign(options, parseCliFlag(arg));
  }

  return options;
}

/**
 * CLI entry point: parse flags, load any config file, run Rollup, generate
 * docs, write outputs.
 *
 * @example
 * ```ts
 * // Called from CLI: sveld --types --json --glob
 * // Parses: { types: true, json: true, glob: true }
 * ```
 */
export async function cli(process: NodeJS.Process) {
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

  // Read the committed snapshot before `writeOutput` can overwrite it.
  let checkResult: CheckResult | undefined;
  if (options.check) {
    checkResult = await runCheck(result.components, resolveCheckSnapshotFile(options), {
      entryExports: result.entryExports,
    });
  }

  writeOutput(result, options, input);

  const { diagnostics } = result;
  console.log(formatDiagnosticsSummary(diagnostics));

  if (checkResult) {
    console.log(formatCheckReport(checkResult));
    if (checkResult.bump === "major") {
      process.exitCode = 1;
    }
  }

  if (options.strict && diagnostics.length > 0) {
    process.exitCode = 1;
  }
}
