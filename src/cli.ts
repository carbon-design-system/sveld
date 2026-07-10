import { existsSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { asSvelteEntryPoint } from "./brands";
import {
  type CheckResult,
  formatCheckReport,
  formatCheckReportJson,
  resolveCheckSnapshotFile,
  runCheck,
} from "./check";
import { formatDiagnosticsSummary, formatDiagnosticsSummaryJson } from "./diagnostics";
import { getSvelteEntry } from "./get-svelte-entry";
import { loadConfig, mergeConfig, type SveldRuntimeOptions } from "./load-config";
import { setQuiet } from "./logger";
import { normalizeSeparators } from "./path";
import { generateBundle, toGenerateBundleOptions, writeOutput, writeStdout } from "./plugin";

/** Relative fallback entry used only when entry resolution otherwise fails. */
const FALLBACK_ENTRY = "src/index.js";

/**
 * Documented exit code contract so scripts can branch on failure kind
 * without parsing output. When more than one applies in a single run, the
 * lowest code wins (1 beats 2 beats 3 beats 4).
 */
const EXIT_CODES = {
  SUCCESS: 0,
  USAGE_ERROR: 1,
  GENERATION_FAILURE: 2,
  BREAKING_CHANGE: 3,
  DIAGNOSTICS: 4,
} as const;

/** CLI options: identical surface to the shared runtime options. */
type CliOptions = SveldRuntimeOptions;

const HELP_TEXT = `Usage: sveld [options]

Generate TypeScript definitions and component documentation for a Svelte
library. With no flags, only TypeScript definitions are generated for the
entry resolved from package.json#svelte.

--entry, --cache, --check, and --types-format accept their value as
--flag=value or as a separate --flag value argument.

Options:
  --entry=<path>        Entry point to uncompiled Svelte source (default: package.json "svelte" field)
  --glob                Analyze all *.svelte files instead of the entry barrel
  --types               Generate TypeScript definitions (default: true)
  --json                Generate component documentation in JSON format
  --markdown            Generate component documentation in Markdown format
  --custom-elements     Generate a Custom Elements Manifest (custom-elements.json)
  --fail-fast           Abort the run when a single component fails to parse
  --quiet               Suppress progress logs (errors, the diagnostics summary, and the --check report are unaffected)
  --stdout[=json|ndjson] Print the document from exactly one of --json, --markdown, or --custom-elements to stdout and write nothing to disk (rejects --types and --check); --stdout=ndjson prints one JSON object per component per line and requires --json
  --cache[=<path>]      Persist parsed output and skip re-parsing unchanged files (on by default, default path: node_modules/.cache/sveld/parse-cache.json; pass --cache=false to disable)
  --resolve-types       Expand opaque imported $props() types into JSON (alias: --resolveTypes, deprecated)
  --check-examples      Compile-check @example blocks against the TypeScript program (alias: --checkExamples, deprecated)
  --report-diagnostics  Print unresolved-type diagnostics to stderr
  --strict              Exit with code 1 when diagnostics exist (implies --report-diagnostics)
  --types-format=<format>  ".d.ts" output format: "class" (default) or "component" (Svelte 5 Component<...>)
  --check[=<path>]      Diff the parsed API against a committed snapshot; exit 1 on a breaking change (default path: COMPONENT_API.json)
  --format=<text|json>  Output format for the --check report and the diagnostics summary (default: text)
  --help                Print this help message and exit
  --version             Print the installed sveld version and exit

Exit codes:
  0  success
  1  usage or configuration error
  2  generation failure
  3  breaking API change detected by --check
  4  diagnostics present under --strict
`;

/** Discriminated result of parsing a single CLI argument, kept side-effect free. */
type CliFlagResult =
  | { kind: "option"; option: Partial<CliOptions> }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "unknown"; arg: string; suggestion?: string }
  | { kind: "usage-error"; message: string };

/** Maps deprecated camelCase flag spellings to their canonical kebab-case form. */
const FLAG_ALIASES: Record<string, string> = {
  resolveTypes: "resolve-types",
  checkExamples: "check-examples",
};

/** Every recognized canonical flag name, used to suggest a fix for a typo'd flag. */
const KNOWN_FLAGS = [
  "help",
  "version",
  "glob",
  "types",
  "json",
  "markdown",
  "quiet",
  "stdout",
  "custom-elements",
  "strict",
  "report-diagnostics",
  "resolve-types",
  "check-examples",
  "fail-fast",
  "entry",
  "cache",
  "check",
  "types-format",
  "format",
];

/** Candidate spellings for typo suggestions: canonical flags plus deprecated aliases. */
const FLAG_SUGGESTION_CANDIDATES = [...KNOWN_FLAGS, ...Object.keys(FLAG_ALIASES)];

/** Boolean flags that never consume a following argument as a value. */
const BOOLEAN_FLAGS = new Set([
  "glob",
  "types",
  "json",
  "markdown",
  "quiet",
  "custom-elements",
  "strict",
  "report-diagnostics",
  "resolve-types",
  "check-examples",
  "fail-fast",
]);

/** Value-taking flags that also accept their value as the next argument. */
const SPACE_SEPARATED_VALUE_FLAGS = new Set(["entry", "cache", "check", "types-format"]);

/** Of those, the flags that error (rather than falling back to a bare default) when no value is given. */
const REQUIRES_VALUE_FLAGS = new Set(["entry", "types-format"]);

/** Largest edit distance for which a typo suggestion is still offered. */
const MAX_SUGGESTION_DISTANCE = 3;

/** Classic Levenshtein edit distance between two strings. */
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const columns = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));

  for (let i = 0; i < rows; i++) distances[i][0] = i;
  for (let j = 0; j < columns; j++) distances[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < columns; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + substitutionCost,
      );
    }
  }

  return distances[rows - 1][columns - 1];
}

/** Closest known flag (canonical spelling) to an unrecognized raw flag name, or undefined if none is close enough. */
function suggestFlag(rawFlag: string): string | undefined {
  let closest: string | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of FLAG_SUGGESTION_CANDIDATES) {
    const distance = levenshteinDistance(rawFlag, candidate);

    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }

  if (closest === undefined || closestDistance > MAX_SUGGESTION_DISTANCE) {
    return undefined;
  }

  return FLAG_ALIASES[closest] ?? closest;
}

/**
 * Parses one `--flag` argument, given the raw next argument so value-taking
 * flags can decide whether to consume it as a space-separated value. `arg`
 * is assumed to start with `--`; positional (non-flag) arguments are handled
 * by the caller. Returns the resolved canonical flag name alongside the
 * result so the caller can track flag-adjacent parsing state (for example,
 * whether the previous flag was boolean) without re-parsing `arg`.
 */
function parseCliFlag(
  arg: string,
  rawNextArg: string | undefined,
): { result: CliFlagResult; consumedNext: boolean; flag: string } {
  const eqIndex = arg.indexOf("=");
  const rawFlag = eqIndex === -1 ? arg.slice(2) : arg.slice(2, eqIndex);
  const flag = FLAG_ALIASES[rawFlag] ?? rawFlag;
  let value: string | boolean = eqIndex === -1 ? true : arg.slice(eqIndex + 1);
  let consumedNext = false;

  if (eqIndex === -1 && SPACE_SEPARATED_VALUE_FLAGS.has(flag)) {
    if (rawNextArg !== undefined && !rawNextArg.startsWith("--")) {
      value = rawNextArg;
      consumedNext = true;
    } else if (REQUIRES_VALUE_FLAGS.has(flag)) {
      return {
        result: {
          kind: "usage-error",
          message: `sveld: --${flag} requires a value (pass --${flag}=<value> or --${flag} <value>).`,
        },
        consumedNext: false,
        flag,
      };
    }
  }

  return { result: parseCliFlagValue(flag, value, arg, rawFlag), consumedNext, flag };
}

function parseCliFlagValue(flag: string, value: string | boolean, arg: string, rawFlag: string): CliFlagResult {
  switch (flag) {
    case "help":
      return { kind: "help" };
    case "version":
      return { kind: "version" };
    case "glob":
    case "types":
    case "json":
    case "markdown":
    case "quiet":
      return { kind: "option", option: { [flag]: value === true || value === "true" } };
    case "stdout":
      // Bare `--stdout` (or `--stdout=true`) keeps the single-document
      // default; `--stdout=json`/`--stdout=ndjson` select the format
      // explicitly. Any other value is validated (and rejected) in `cli()`.
      if (value === true || value === "true") return { kind: "option", option: { stdout: true } };
      if (value === "false") return { kind: "option", option: { stdout: false } };
      return { kind: "option", option: { stdout: value as "json" | "ndjson" } };
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
      // The cache is on by default; bare `--cache` re-affirms the default
      // location, `--cache=<path>` overrides it, and `--cache=false` disables it.
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
    case "format":
      // The value is validated in `cli()` once it can be reported as a usage
      // error (`--format=yaml`); a bare `--format` is silently ignored.
      return typeof value === "string"
        ? { kind: "option", option: { format: value as "text" | "json" } }
        : { kind: "option", option: {} };
    default:
      return { kind: "unknown", arg, suggestion: suggestFlag(rawFlag) };
  }
}

/** Discriminated result of parsing the full argument list. */
export type CliParseResult =
  | { kind: "options"; options: CliOptions }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "unknown"; arg: string; suggestion?: string; positionalHint?: boolean }
  | { kind: "usage-error"; message: string };

export function parseCliOptions(argv: string[]): CliParseResult {
  const options: CliOptions = {};
  let previousFlagWasBoolean = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!arg.startsWith("--")) {
      return { kind: "unknown", arg, positionalHint: previousFlagWasBoolean ? true : undefined };
    }

    const { result, consumedNext, flag } = parseCliFlag(arg, argv[i + 1]);

    if (result.kind !== "option") {
      return result;
    }

    Object.assign(options, result.option);
    previousFlagWasBoolean = BOOLEAN_FLAGS.has(flag);

    if (consumedNext) {
      i++;
    }
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

  if (parsed.kind === "usage-error") {
    console.error(parsed.message);
    process.exitCode = EXIT_CODES.USAGE_ERROR;
    return;
  }

  if (parsed.kind === "unknown") {
    let message = `Unknown flag: ${parsed.arg}`;

    if (parsed.suggestion) {
      message += ` Did you mean --${parsed.suggestion}?`;
    }

    if (parsed.positionalHint) {
      message += " (values are passed as --flag=value or --flag value)";
    }

    console.error(message);
    console.error("Run sveld --help for a list of available flags.");
    process.exitCode = EXIT_CODES.USAGE_ERROR;
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

  if (options.stdout) {
    if (options.stdout !== true && options.stdout !== "json" && options.stdout !== "ndjson") {
      console.error(`sveld: --stdout must be "json" or "ndjson"; got "${options.stdout}".`);
      process.exitCode = EXIT_CODES.USAGE_ERROR;
      return;
    }

    const selectedOutputs = [options.json, options.markdown, options.customElements].filter(Boolean).length;

    if (selectedOutputs !== 1) {
      console.error("sveld: --stdout requires exactly one of --json, --markdown, or --custom-elements.");
      process.exitCode = EXIT_CODES.USAGE_ERROR;
      return;
    }

    if (options.stdout === "ndjson" && !options.json) {
      console.error("sveld: --stdout=ndjson is only valid with --json.");
      process.exitCode = EXIT_CODES.USAGE_ERROR;
      return;
    }

    if (options.types === true) {
      console.error("sveld: --stdout cannot be combined with --types; type definitions span multiple files.");
      process.exitCode = EXIT_CODES.USAGE_ERROR;
      return;
    }

    if (options.check) {
      console.error("sveld: --stdout cannot be combined with --check; both write their document to stdout.");
      process.exitCode = EXIT_CODES.USAGE_ERROR;
      return;
    }
  }

  if (options.format !== undefined && options.format !== "text" && options.format !== "json") {
    console.error(`sveld: --format must be "text" or "json"; got "${options.format}".`);
    process.exitCode = EXIT_CODES.USAGE_ERROR;
    return;
  }

  setQuiet(options.quiet === true);

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
    process.exitCode = EXIT_CODES.USAGE_ERROR;
    return;
  }

  let result: Awaited<ReturnType<typeof generateBundle>>;
  let checkResult: CheckResult | undefined;

  try {
    result = await generateBundle(input, options.glob === true, toGenerateBundleOptions(options));

    // Read the committed snapshot before `writeOutput` can overwrite it.
    if (options.check) {
      checkResult = await runCheck(result.components, resolveCheckSnapshotFile(options), {
        entryExports: result.entryExports,
      });
    }

    if (options.stdout) {
      await writeStdout(result, options, input);
    } else {
      await writeOutput(result, options, input);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = EXIT_CODES.GENERATION_FAILURE;
    return;
  }

  const { diagnostics } = result;
  const shouldReport = options.reportDiagnostics || options.strict;

  if (shouldReport && diagnostics.length > 0) {
    if (options.format === "json") {
      process.stderr.write(formatDiagnosticsSummaryJson(diagnostics));
    } else {
      console.error(formatDiagnosticsSummary(diagnostics));
    }
  }

  if (checkResult) {
    if (options.format === "json") {
      process.stdout.write(formatCheckReportJson(checkResult));
    } else {
      console.log(formatCheckReport(checkResult));
    }
  }

  // Lowest applicable code wins (3 beats 4); every failure is still reported above.
  let exitCode: number | undefined;

  if (checkResult?.bump === "major") {
    exitCode = EXIT_CODES.BREAKING_CHANGE;
  }

  if (options.strict && diagnostics.length > 0) {
    exitCode = exitCode === undefined ? EXIT_CODES.DIAGNOSTICS : Math.min(exitCode, EXIT_CODES.DIAGNOSTICS);
  }

  if (exitCode !== undefined) {
    process.exitCode = exitCode;
  }
}
