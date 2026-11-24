import { realpathSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { type ComponentParseError, type GenerateBundleResult, generateBundle, toGenerateBundleOptions } from "./bundle";
import {
  bumpMeetsLevel,
  type CheckLevel,
  type CheckResult,
  resolveCheckSnapshotFile,
  runCheck,
  writesCheckSnapshot,
} from "./check";
import {
  failingDiagnostics,
  filterSpeculativeDiagnostics,
  formatDiagnosticsGithub,
  formatDiagnosticsSummary,
  formatDiagnosticsSummaryJson,
  type SveldDiagnostic,
} from "./diagnostics";
import { getSvelteEntry, UNRESOLVED_ENTRY_MESSAGE } from "./get-svelte-entry";
import { loadConfigOption, mergeConfig, type SveldRuntimeOptions, validateOptions } from "./load-config";
import { setQuiet } from "./logger";
import { normalizeSeparators } from "./path";
import { writeOutput, writeStdout } from "./plugin";
import type { ComponentApiDocument } from "./writer/document-model";
import { buildJsonDocument } from "./writer/writer-json";

/** Result of a programmatic `sveld` run. */
export interface SveldResult {
  /** Diagnostics from this run. */
  diagnostics: SveldDiagnostic[];
  /**
   * Populated when `check` is enabled: the API diff against the
   * committed snapshot.
   */
  check?: CheckResult;
  /**
   * Parse errors for components that failed to parse (empty unless
   * `failFast` is disabled and a component errors).
   */
  errors: ComponentParseError[];
  /**
   * The component API document for the exported components, exactly as the
   * `json` writer writes `COMPONENT_API.json`. Populated whether or not
   * `json` is enabled, so custom output can be rendered from it directly.
   */
  document: ComponentApiDocument;
  /**
   * Suggested process exit code for this run, as the CLI exits: `0` done,
   * `1` problems found, `2` the run couldn't do what it was asked.
   * `sveld()` never mutates `process.exitCode` itself; assign this value
   * yourself if you want the process to exit non-zero.
   */
  exitCode: 0 | 1 | 2;
  /** Why `exitCode` isn't `0`, each reason that applied, in this order. */
  failures: SveldFailure[];
}

/**
 * A reason a run doesn't exit `0`. `"missing-snapshot"` exits `2`; the
 * others exit `1`.
 */
export type SveldFailure = "missing-snapshot" | "outdated-snapshot" | "parse-error" | "breaking-change" | "diagnostics";

// Shared by the CLI and `sveld()`, so their codes can't drift. A missing
// snapshot (unless this run writes it) exits `2`, since a mistyped path
// mustn't pass; every other failure is a problem found, so `1`.
function resolveExitCode(run: {
  errors: readonly unknown[];
  check?: CheckResult;
  /** From {@link writesCheckSnapshot}. */
  writesSnapshot?: boolean;
  checkLevel?: CheckLevel;
  diagnostics: SveldDiagnostic[];
  strict?: boolean | "errors";
}): { exitCode: 0 | 1 | 2; failures: SveldFailure[] } {
  const failures: SveldFailure[] = [];
  if (run.check && !run.check.snapshotExists && !run.writesSnapshot) failures.push("missing-snapshot");
  if (run.check?.changes.some((change) => change.kind === "schema")) failures.push("outdated-snapshot");
  if (run.errors.length > 0) failures.push("parse-error");
  if (run.check && bumpMeetsLevel(run.check.bump, run.checkLevel ?? "major")) failures.push("breaking-change");
  if (failingDiagnostics(run.diagnostics, run.strict).length > 0) failures.push("diagnostics");
  const exitCode = failures.includes("missing-snapshot") ? 2 : failures.length > 0 ? 1 : 0;
  return { exitCode, failures };
}

// With `check`, the committed snapshot is diffed first, since
// `writeOutput` would overwrite it.
export async function buildAndWrite(
  input: string,
  options: SveldRuntimeOptions,
  toStdout = false,
): Promise<{ result: GenerateBundleResult; check?: CheckResult }> {
  const result = await generateBundle(input, options.glob === true, toGenerateBundleOptions(options));
  const check = options.check
    ? await runCheck(result.components, resolveCheckSnapshotFile(options), { entryExports: result.entryExports })
    : undefined;

  if (toStdout) writeStdout(result, options, input);
  else await writeOutput(result, options, input);
  return { result, check };
}

// Relative to the repository root, since that's where GitHub places an
// annotation. `GITHUB_WORKSPACE` is the root on a runner; elsewhere it's
// the working directory.
function githubFileResolver(input: string): (component: string) => string {
  // Resolved through symlinks on both sides, so a symlinked checkout (macOS
  // `/tmp`) can't turn the relative path into `../../...`.
  const rootDir = realpathSync(statSync(input).isFile() ? dirname(input) : input);
  const workspace = realpathSync(process.env.GITHUB_WORKSPACE || process.cwd());
  return (component) => normalizeSeparators(relative(workspace, resolve(rootDir, component)));
}

// Shared by the CLI and `sveld()` so their reporting and exit codes can't
// drift apart. `input` is the resolved entry, which `format: "github"`
// needs to place annotations.
export function reportRun(
  result: GenerateBundleResult,
  check: CheckResult | undefined,
  options: SveldRuntimeOptions,
  input: string,
): { diagnostics: SveldDiagnostic[]; exitCode: 0 | 1 | 2; failures: SveldFailure[] } {
  const shouldReport = options.reportDiagnostics || options.strict;
  const diagnostics = filterSpeculativeDiagnostics(result.diagnostics, shouldReport);

  if (shouldReport && diagnostics.length > 0) {
    if (options.format === "json") {
      process.stderr.write(formatDiagnosticsSummaryJson(diagnostics));
    } else {
      // The annotations land on the diff; the grouped summary stays in the
      // log, where an annotation shows only its message, not its file.
      if (options.format === "github") {
        const annotations = formatDiagnosticsGithub(diagnostics, githubFileResolver(input));
        if (annotations) console.error(annotations);
      }
      console.error(formatDiagnosticsSummary(diagnostics));
    }
  }

  const { exitCode, failures } = resolveExitCode({
    errors: result.errors,
    check,
    writesSnapshot: check ? writesCheckSnapshot(options, check.snapshotFile) : false,
    checkLevel: options.checkLevel,
    diagnostics,
    strict: options.strict,
  });
  return { diagnostics, exitCode, failures };
}

export interface SveldOptions extends Omit<SveldRuntimeOptions, "config"> {
  /**
   * Whether to load `sveld.config.{js,mjs,ts}` from the working directory
   * and merge it under these options. `false` ignores it.
   * @default true
   */
  config?: boolean;
}

/**
 * Programmatic entry point for sveld.
 *
 * @example
 * ```ts
 * await sveld({
 *   entry: "./src",
 *   types: true,
 *   json: true,
 *   markdown: true,
 *   glob: true
 * });
 * ```
 */
export async function sveld(opts?: SveldOptions): Promise<SveldResult> {
  if (opts && "input" in opts) {
    throw new Error("sveld: the `input` option was renamed to `entry`.");
  }
  // Read as `unknown`, since a JavaScript caller can pass any value,
  // whatever the type says.
  const config: unknown = opts?.config;
  if (typeof config === "string") {
    throw new Error(
      "sveld: `config` takes `true` or `false`; import another config file and pass its options instead.",
    );
  }

  const { entry: entryOverride, ...runtimeOpts } = opts ?? {};
  const fileConfig = await loadConfigOption(runtimeOpts.config, process.cwd(), true);
  const input = getSvelteEntry(entryOverride ?? fileConfig.entry);
  if (input === null) {
    throw new Error(UNRESOLVED_ENTRY_MESSAGE);
  }
  const merged = mergeConfig<SveldRuntimeOptions>(fileConfig, runtimeOpts, { entry: input });
  validateOptions(merged);
  setQuiet(merged.quiet === true);
  const { result, check: checkResult } = await buildAndWrite(input, merged);
  const { diagnostics, exitCode, failures } = reportRun(result, checkResult, merged, input);

  const document = buildJsonDocument(result.components, {
    inputDir: dirname(input),
    entryExports: result.entryExports,
    source: merged.jsonOptions?.source,
  });

  return { diagnostics, check: checkResult, errors: result.errors, document, exitCode, failures };
}
