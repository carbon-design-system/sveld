import { existsSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { asSvelteEntryPoint } from "./brands";
import { type CheckResult, formatCheckReport, resolveCheckSnapshotFile, runCheck } from "./check";
import { formatDiagnosticsSummary } from "./diagnostics";
import { getSvelteEntry } from "./get-svelte-entry";
import { loadConfig, mergeConfig, type SveldRuntimeOptions } from "./load-config";
import { normalizeSeparators } from "./path";
import { generateBundle, toGenerateBundleOptions, writeOutput } from "./plugin";

/** Relative fallback entry used only when entry resolution otherwise fails. */
const FALLBACK_ENTRY = "src/index.js";

/** CLI options: identical surface to the shared runtime options. */
type CliOptions = SveldRuntimeOptions;

const HELP_TEXT = `Usage: sveld [options]

Generate TypeScript definitions and component documentation for a Svelte
library. With no flags, only TypeScript definitions are generated for the
entry resolved from package.json#svelte.

Options:
  --entry=<path>        Entry point to uncompiled Svelte source (default: package.json "svelte" field)
  --glob                Analyze all *.svelte files instead of the entry barrel
  --types               Generate TypeScript definitions (default: true)
  --json                Generate component documentation in JSON format
  --markdown            Generate component documentation in Markdown format
  --custom-elements     Generate a Custom Elements Manifest (custom-elements.json)
  --fail-fast           Abort the run when a single component fails to parse
  --cache[=<path>]      Persist parsed output and skip re-parsing unchanged files (default path: node_modules/.cache/sveld/parse-cache.json)
  --resolve-types       Expand opaque imported $props() types into JSON (alias: --resolveTypes, deprecated)
  --check-examples      Compile-check @example blocks against the TypeScript program (alias: --checkExamples, deprecated)
  --report-diagnostics  Print unresolved-type diagnostics to stderr
  --strict              Exit with code 1 when diagnostics exist (implies --report-diagnostics)
  --types-format=<format>  ".d.ts" output format: "class" (default) or "component" (Svelte 5 Component<...>)
  --check[=<path>]      Diff the parsed API against a committed snapshot; exit 1 on a breaking change (default path: COMPONENT_API.json)
  --help                Print this help message and exit
  --version             Print the installed sveld version and exit
`;

/** Discriminated result of parsing a single CLI argument, kept side-effect free. */
type CliFlagResult =
  | { kind: "option"; option: Partial<CliOptions> }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "unknown"; arg: string };

/** Maps deprecated camelCase flag spellings to their canonical kebab-case form. */
const FLAG_ALIASES: Record<string, string> = {
  resolveTypes: "resolve-types",
  checkExamples: "check-examples",
};

function parseCliFlag(arg: string): CliFlagResult {
  if (!arg.startsWith("--")) {
    return { kind: "unknown", arg };
  }

  const eqIndex = arg.indexOf("=");
  const rawFlag = eqIndex === -1 ? arg.slice(2) : arg.slice(2, eqIndex);
  const value = eqIndex === -1 ? true : arg.slice(eqIndex + 1);
  const flag = FLAG_ALIASES[rawFlag] ?? rawFlag;

  switch (flag) {
    case "help":
      return { kind: "help" };
    case "version":
      return { kind: "version" };
    case "glob":
    case "types":
    case "json":
    case "markdown":
      return { kind: "option", option: { [flag]: value === true || value === "true" } };
    case "custom-elements":
      return { kind: "option", option: { customElements: value === true || value === "true" } };
    case "strict":
      return { kind: "option", option: { strict: value === true || value === "true" } };
    case "report-diagnostics":
      return { kind: "option", option: { reportDiagnostics: value === true || value === "true" } };
    case "resolve-types":
      return { kind: "option", option: { resolveTypes: value === true || value === "true" } };
    case "check-examples":
      return { kind: "option", option: { checkExamples: value === true || value === "true" } };
    case "fail-fast":
      return { kind: "option", option: { failFast: value === true || value === "true" } };
    case "entry":
      return typeof value === "string" ? { kind: "option", option: { entry: value } } : { kind: "option", option: {} };
    case "cache":
      // Bare `--cache` enables the default cache location; `--cache=<path>`
      // overrides it; `--cache=false` disables it.
      if (value === "false") return { kind: "option", option: { cache: false } };
      return { kind: "option", option: { cache: typeof value === "string" ? value : true } };
    case "check":
      // Bare `--check` diffs against the default snapshot path;
      // `--check=<path>` overrides it; `--check=false` disables it.
      if (value === "false") return { kind: "option", option: { check: false } };
      return { kind: "option", option: { check: typeof value === "string" ? value : true } };
    case "types-format":
      return typeof value === "string"
        ? { kind: "option", option: { typesOptions: { format: value as "class" | "component" } } }
        : { kind: "option", option: {} };
    default:
      return { kind: "unknown", arg };
  }
}

/** Discriminated result of parsing the full argument list. */
export type CliParseResult =
  | { kind: "options"; options: CliOptions }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "unknown"; arg: string };

export function parseCliOptions(argv: string[]): CliParseResult {
  const options: CliOptions = {};

  for (const arg of argv) {
    const result = parseCliFlag(arg);

    if (result.kind !== "option") {
      return result;
    }

    Object.assign(options, result.option);
  }

  return { kind: "options", options };
}

/**
 * CLI entry point: parse flags, load any config file, generate docs, write
 * outputs.
 *
 * @example
 * ```ts
 * // Called from CLI: sveld --types --json --glob
 * // Parses: { types: true, json: true, glob: true }
 * ```
 */
export async function cli(process: NodeJS.Process) {
  const parsed = parseCliOptions(process.argv.slice(2));

  if (parsed.kind === "help") {
    console.log(HELP_TEXT);
    return;
  }

  if (parsed.kind === "version") {
    console.log(pkg.version);
    return;
  }

  if (parsed.kind === "unknown") {
    console.error(`Unknown flag: ${parsed.arg}`);
    console.error("Run sveld --help for a list of available flags.");
    process.exitCode = 1;
    return;
  }

  const cliOptions = parsed.options;
  const fileConfig = await loadConfig();
  const options = mergeConfig<CliOptions>(fileConfig, cliOptions);

  /**
   * `mergeConfig` shallow-merges: `--types-format` alone would otherwise
   * replace a config file's whole `typesOptions` object instead of adding to it.
   */
  if (fileConfig.typesOptions || cliOptions.typesOptions) {
    options.typesOptions = { ...fileConfig.typesOptions, ...cliOptions.typesOptions };
  }

  const resolvedEntry = getSvelteEntry(options.entry);
  let input: string;

  if (resolvedEntry !== null) {
    input = resolvedEntry;
  } else if (existsSync(join(process.cwd(), FALLBACK_ENTRY))) {
    console.error(
      `sveld: could not resolve an entry point; falling back to "${FALLBACK_ENTRY}". Set package.json#svelte (or pass --entry) to avoid relying on this fallback.`,
    );
    input = asSvelteEntryPoint(normalizeSeparators(FALLBACK_ENTRY));
  } else {
    process.exitCode = 1;
    return;
  }

  const result = await generateBundle(input, options.glob === true, toGenerateBundleOptions(options));

  // Read the committed snapshot before `writeOutput` can overwrite it.
  let checkResult: CheckResult | undefined;
  if (options.check) {
    checkResult = await runCheck(result.components, resolveCheckSnapshotFile(options), {
      entryExports: result.entryExports,
    });
  }

  await writeOutput(result, options, input);

  const { diagnostics } = result;
  const shouldReport = options.reportDiagnostics || options.strict;

  if (shouldReport && diagnostics.length > 0) {
    console.error(formatDiagnosticsSummary(diagnostics));
  }

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
