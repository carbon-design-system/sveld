import resolve from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";
import svelte from "rollup-plugin-svelte";
import { formatDiagnosticsSummary } from "./diagnostics";
import { getSvelteEntry } from "./get-svelte-entry";
import { generateBundle, type PluginSveldOptions, writeOutput } from "./plugin";

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

/**
 * CLI entry point: parse flags, run Rollup, generate docs, write outputs.
 *
 * @example
 * ```ts
 * // Called from CLI: sveld --types --json --glob
 * // Parses: { types: true, json: true, glob: true }
 * ```
 */
export async function cli(process: NodeJS.Process) {
  const options = parseCliOptions(process.argv.slice(2));

  const input = getSvelteEntry() || "src/index.js";
  const rollup_bundle = await rollup({
    input,
    plugins: [svelte(), resolve()],
  });

  await rollup_bundle.generate({});

  const result = await generateBundle(input, options.glob === true, { failFast: options.failFast });

  writeOutput(result, options, input);

  const { diagnostics } = result;
  console.log(formatDiagnosticsSummary(diagnostics));

  if (options.strict && diagnostics.length > 0) {
    process.exitCode = 1;
  }
}
