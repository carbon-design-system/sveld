import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { asSvelteEntryPoint } from "./brands";
import {
  type CheckResult,
  formatCheckReport,
  formatCheckReportJson,
  resolveCheckSnapshotFile,
  runCheck,
  writesCheckSnapshot,
} from "./check";
import { filterSpeculativeDiagnostics, formatDiagnosticsSummary, formatDiagnosticsSummaryJson } from "./diagnostics";
import { resolveSvelteEntry } from "./get-svelte-entry";
import { closestMatch } from "./levenshtein";
import {
  loadConfig,
  loadConfigFrom,
  mergeConfig,
  type SveldConfig,
  type SveldRuntimeOptions,
  validateOptions,
} from "./load-config";
import { setQuiet } from "./logger";
import { normalizeSeparators } from "./path";
import { generateBundle, toGenerateBundleOptions, writeOutput, writeStdout } from "./plugin";
import { UnresolvedModuleError } from "./resolve-alias";
import { resolveExitCode } from "./sveld";

/** Used only when nothing configures an entry. */
const FALLBACK_ENTRY = "src/index.js";

/** When more than one applies in a single run, the lowest code wins. */
const EXIT_CODES = {
  SUCCESS: 0,
  USAGE_ERROR: 1,
  GENERATION_FAILURE: 2,
  BREAKING_CHANGE: 3,
  DIAGNOSTICS: 4,
} as const;

const HELP_TEXT = `Usage: sveld [options]

Generate TypeScript definitions and component documentation for a Svelte
library. With no flags, only TypeScript definitions are generated for the
entry resolved from package.json#svelte.

--entry, --config, --cache, --check, and --types-format accept their
value as --flag=value or as a separate --flag value argument.

Options:
  --entry=<path>        Entry point to uncompiled Svelte source (default: package.json "svelte" field)
  --config=<path>       Load this config file (relative to the working directory) instead of discovering sveld.config.{js,mjs,ts}
  --glob                Analyze all *.svelte files instead of the entry barrel
  --types               Generate TypeScript definitions (default: true)
  --json                Generate component documentation in JSON format
  --markdown            Generate component documentation in Markdown format
  --fail-fast           Abort the run when a single component fails to parse
  -q, --quiet           Suppress progress logs (errors, the diagnostics summary, and the --check report are unaffected)
  --stdout              Print the document from exactly one of --json or --markdown to stdout and write nothing to disk (rejects --types and --check)
  --cache[=<path>]      Persist parsed output and skip re-parsing unchanged files (on by default, default path: node_modules/.cache/sveld/parse-cache.json; pass --cache=false to disable)
  --check-examples[=syntax]  Check @example blocks: TS/JS against the TypeScript program, svelte/html markup against sveast; --check-examples=syntax runs only the markup path and never loads TypeScript
  --report-diagnostics  Print unresolved-type diagnostics to stderr
  --strict[=errors]     Exit with code 4 when diagnostics exist (implies --report-diagnostics); --strict=errors only fails on error-severity diagnostics
  --types-format=<format>  ".d.ts" output format: "class" (default) or "component" (Svelte 5 Component<...>)
  --types-index-types    Sets typesOptions.indexTypes; also re-exports generated types from index.d.ts (pass --types-index-types=false to disable)
  --check[=<path>]      Diff the parsed API against a committed snapshot; exit 3 on a breaking change (default path: COMPONENT_API.json)
  --check-level=<major|minor|patch>  Minimum bump --check fails the run on (default: major)
  --format=<text|json>  Output format for the --check report and the diagnostics summary (default: text)
  -h, --help            Print this help message and exit
  -v, --version         Print the installed sveld version and exit

Exit codes:
  0  success
  1  usage or configuration error
  2  generation failure
  3  breaking API change detected by --check
  4  diagnostics present under --strict
`;

type CliFlagResult =
  | { kind: "option"; option: Partial<SveldRuntimeOptions> }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "unknown"; arg: string; suggestion?: string }
  | { kind: "usage-error"; message: string };

/** Suggestion candidates for a typo'd flag. */
const KNOWN_FLAGS = [
  "help",
  "version",
  "glob",
  "types",
  "json",
  "markdown",
  "quiet",
  "stdout",
  "strict",
  "report-diagnostics",
  "check-examples",
  "fail-fast",
  "entry",
  "config",
  "cache",
  "check",
  "check-level",
  "types-format",
  "types-index-types",
  "format",
];

const SHORT_FLAGS = new Map([
  ["-h", "--help"],
  ["-v", "--version"],
  ["-q", "--quiet"],
]);

const UPPERCASE_RE = /[A-Z]/g;

/** Boolean flags that never consume a following argument as a value. */
const BOOLEAN_FLAGS = new Set([
  "glob",
  "types",
  "json",
  "markdown",
  "quiet",
  "stdout",
  "strict",
  "report-diagnostics",
  "check-examples",
  "fail-fast",
  "types-index-types",
]);

/** Value-taking flags that also accept their value as the next argument. */
const SPACE_SEPARATED_VALUE_FLAGS = new Set(["entry", "config", "cache", "check", "types-format"]);

/** Of those, the flags that error (rather than using a bare default) when no value is given. */
const REQUIRES_VALUE_FLAGS = new Set(["entry", "config", "types-format"]);

/** camelCase input is kebab-cased first, so `--failFast` suggests `--fail-fast`. */
function suggestFlag(rawFlag: string): string | undefined {
  const kebab = rawFlag.replace(UPPERCASE_RE, (letter) => `-${letter.toLowerCase()}`);
  return closestMatch(kebab, KNOWN_FLAGS);
}

/** Parses one `--flag` argument, consuming `rawNextArg` as its value when the flag takes one. */
function parseCliFlag(
  arg: string,
  rawNextArg: string | undefined,
): { result: CliFlagResult; consumedNext: boolean; flag: string } {
  const eqIndex = arg.indexOf("=");
  const flag = eqIndex === -1 ? arg.slice(2) : arg.slice(2, eqIndex);
  let value: string | boolean = eqIndex === -1 ? true : arg.slice(eqIndex + 1);
  let consumedNext = false;

  if (eqIndex === -1 && SPACE_SEPARATED_VALUE_FLAGS.has(flag)) {
    if (rawNextArg !== undefined && !rawNextArg.startsWith("--") && !SHORT_FLAGS.has(rawNextArg)) {
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

  return { result: parseCliFlagValue(flag, value, arg), consumedNext, flag };
}

function parseCliFlagValue(flag: string, value: string | boolean, arg: string): CliFlagResult {
  const option = (partial: Partial<SveldRuntimeOptions>): CliFlagResult => ({ kind: "option", option: partial });
  const isTrue = value === true || value === "true";
  // Enum-valued flags are cast here and validated in `cli()`, where a bad
  // value is reported as a usage error.
  const stringValue = typeof value === "string" ? value : undefined;

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
      return option({ [flag]: isTrue });
    case "stdout":
      if (isTrue) return option({ stdout: true });
      if (value === "false") return option({ stdout: false });
      return { kind: "usage-error", message: `sveld: --stdout does not take a value; got "${value}".` };
    case "strict":
      if (isTrue) return option({ strict: true });
      if (value === "false") return option({ strict: false });
      return option({ strict: value as "errors" });
    case "report-diagnostics":
      return option({ reportDiagnostics: isTrue });
    case "check-examples":
      if (isTrue) return option({ checkExamples: true });
      if (value === "false") return option({ checkExamples: false });
      return option({ checkExamples: value as "syntax" });
    case "fail-fast":
      return option({ failFast: isTrue });
    case "entry":
      return option(stringValue === undefined ? {} : { entry: stringValue });
    case "config":
      return option(stringValue === undefined ? {} : { config: stringValue });
    case "cache":
      if (value === "false") return option({ cache: false });
      return option({ cache: stringValue ?? true });
    case "check":
      if (value === "false") return option({ check: false });
      return option({ check: stringValue ?? true });
    case "types-format":
      return option(
        stringValue === undefined ? {} : { typesOptions: { format: stringValue as "class" | "component" } },
      );
    case "types-index-types":
      return option({ typesOptions: { indexTypes: isTrue } });
    case "format":
      return option(stringValue === undefined ? {} : { format: stringValue as "text" | "json" });
    case "check-level":
      return option(stringValue === undefined ? {} : { checkLevel: stringValue as "major" | "minor" | "patch" });
    default:
      return { kind: "unknown", arg, suggestion: suggestFlag(flag) };
  }
}

export type CliParseResult =
  | { kind: "options"; options: SveldRuntimeOptions }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "unknown"; arg: string; suggestion?: string; positionalHint?: boolean }
  | { kind: "usage-error"; message: string };

export function parseCliOptions(argv: string[]): CliParseResult {
  let options: SveldRuntimeOptions = {};
  let previousFlagWasBoolean = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = SHORT_FLAGS.get(argv[i]) ?? argv[i];

    if (!arg.startsWith("--")) {
      return { kind: "unknown", arg, positionalHint: previousFlagWasBoolean ? true : undefined };
    }

    const { result, consumedNext, flag } = parseCliFlag(arg, argv[i + 1]);

    if (result.kind !== "option") return result;

    // Not `Object.assign`: `--types-format` and `--types-index-types` each set
    // a `typesOptions` key and mustn't clobber each other.
    options = mergeConfig<SveldRuntimeOptions>(options, result.option);
    previousFlagWasBoolean = BOOLEAN_FLAGS.has(flag);
    if (consumedNext) i++;
  }

  return { kind: "options", options };
}

/**
 * Loads the config file named by `--config` (relative to the working
 * directory), or discovers `sveld.config.{js,mjs,ts}` when it isn't set.
 */
async function loadCliConfig(configPath: SveldConfig["config"]): Promise<SveldConfig> {
  if (typeof configPath !== "string") return loadConfig();
  const resolved = resolve(configPath);
  if (!existsSync(resolved)) {
    throw new Error(`sveld: config file "${configPath}" does not exist.`);
  }
  return loadConfigFrom(resolved);
}

/** Returns `true` when `value` is set to something outside `allowed`. */
function isInvalid(value: unknown, allowed: readonly unknown[]): boolean {
  return value !== undefined && !allowed.includes(value);
}

export async function cli(process: NodeJS.Process) {
  const usageError = (message: string) => {
    console.error(message);
    process.exitCode = EXIT_CODES.USAGE_ERROR;
  };

  const parsed = parseCliOptions(process.argv.slice(2));

  if (parsed.kind === "help") {
    console.log(HELP_TEXT);
    return;
  }

  if (parsed.kind === "version") {
    console.log(pkg.version);
    return;
  }

  if (parsed.kind === "usage-error") return usageError(parsed.message);

  if (parsed.kind === "unknown") {
    let message = `sveld: unknown flag "${parsed.arg}".`;
    if (parsed.suggestion) message += ` Did you mean "--${parsed.suggestion}"?`;
    if (parsed.positionalHint) message += " Values are passed as --flag=value or --flag value.";
    console.error(message);
    return usageError("Run sveld --help for a list of available flags.");
  }

  const cliOptions = parsed.options;
  let fileConfig: SveldConfig;
  try {
    fileConfig = await loadCliConfig(cliOptions.config);
  } catch (error) {
    // The user's to fix, not a crash: print the reason, not sveld's (minified) stack.
    return usageError(error instanceof Error ? error.message : String(error));
  }
  const options = mergeConfig<SveldRuntimeOptions>(fileConfig, cliOptions);
  validateOptions(options);

  if (options.stdout) {
    if ([options.json, options.markdown].filter(Boolean).length !== 1) {
      return usageError("sveld: --stdout requires exactly one of --json or --markdown.");
    }
    if (options.types === true) {
      return usageError("sveld: --stdout cannot be combined with --types; type definitions span multiple files.");
    }
    if (options.check) {
      return usageError("sveld: --stdout cannot be combined with --check; both write their document to stdout.");
    }
  }

  if (isInvalid(options.format, ["text", "json"])) {
    return usageError(`sveld: --format must be "text" or "json"; got "${options.format}".`);
  }
  if (isInvalid(options.strict, [true, false, "errors"])) {
    return usageError(`sveld: --strict must be "errors" when given a value; got "${options.strict}".`);
  }
  if (isInvalid(options.checkLevel, ["major", "minor", "patch"])) {
    return usageError(`sveld: --check-level must be "major", "minor", or "patch"; got "${options.checkLevel}".`);
  }
  if (isInvalid(options.checkExamples, [true, false, "syntax"])) {
    return usageError(`sveld: --check-examples must be "syntax" when given a value; got "${options.checkExamples}".`);
  }
  const typesFormat = options.typesOptions?.format;
  if (isInvalid(typesFormat, ["class", "component"])) {
    return usageError(`sveld: --types-format must be "class" or "component"; got "${typesFormat}".`);
  }

  setQuiet(options.quiet === true);

  const resolution = resolveSvelteEntry(options.entry);
  let input: string;

  if (resolution.entry !== null) {
    input = resolution.entry;
  } else if (!resolution.configured && existsSync(join(process.cwd(), FALLBACK_ENTRY))) {
    // Only when nothing named an entry: a mistyped --entry or package.json#svelte
    // must fail rather than quietly document a different file.
    console.error(
      `sveld: no entry point configured; using "${FALLBACK_ENTRY}". Set package.json#svelte (or pass --entry) to silence this.`,
    );
    input = asSvelteEntryPoint(normalizeSeparators(FALLBACK_ENTRY));
  } else {
    return usageError(`sveld: ${resolution.message}`);
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
      // generateBundle() saved parses only; this adds the `.d.ts` text writeOutput cached.
      result.cache?.save();
    }
  } catch (error) {
    if (error instanceof UnresolvedModuleError) return usageError(`sveld: ${error.message}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = EXIT_CODES.GENERATION_FAILURE;
    return;
  }

  const shouldReport = options.reportDiagnostics || options.strict;
  const diagnostics = filterSpeculativeDiagnostics(result.diagnostics, shouldReport);

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

  // Every failure is still reported above; the lowest applicable code wins.
  const exitCode = resolveExitCode({
    errors: result.errors,
    check: checkResult,
    writesSnapshot: checkResult ? writesCheckSnapshot(options, checkResult.snapshotFile) : false,
    checkLevel: options.checkLevel,
    diagnostics,
    strict: options.strict,
  });
  if (exitCode !== EXIT_CODES.SUCCESS) process.exitCode = exitCode;
}
