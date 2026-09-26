import { dirname } from "node:path";
import type { ComponentParseError } from "./bundle";
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
  formatDiagnosticsSummary,
  formatDiagnosticsSummaryJson,
  type SveldDiagnostic,
} from "./diagnostics";
import { getSvelteEntry } from "./get-svelte-entry";
import { loadConfig, mergeConfig, type SveldRuntimeOptions, validateOptions } from "./load-config";
import { setQuiet } from "./logger";
import { generateBundle, toGenerateBundleOptions, writeOutput } from "./plugin";
import type { ComponentApiDocument } from "./writer/document-model";
import { buildJsonDocument } from "./writer/writer-json";

type SveldOptions = SveldRuntimeOptions;

/**
 * Result of a programmatic `sveld` run.
 */
export interface SveldResult {
  /** Diagnostics from this run. */
  diagnostics: SveldDiagnostic[];
  /** Populated when `check` is enabled: the API diff against the committed snapshot. */
  check?: CheckResult;
  /** Parse errors for components that failed to parse (empty unless `failFast` is disabled and a component errors). */
  errors: ComponentParseError[];
  /**
   * The component API document for the exported components, exactly as the
   * `json` writer writes `COMPONENT_API.json`. Populated whether or not
   * `json` is enabled, so custom output can be rendered from it directly.
   */
  document: ComponentApiDocument;
  /**
   * Suggested process exit code for this run, using the same mapping as the
   * CLI (see {@link resolveExitCode}). `sveld()` never mutates `process.exitCode` itself; assign this
   * value yourself if you want the process to exit non-zero.
   */
  exitCode: ExitCode;
}

type ExitCode = 0 | 1 | 2 | 3 | 4;

/**
 * The exit-code contract shared by the CLI and `sveld()`. The lowest
 * applicable code wins: `1` for a `check` snapshot that's missing (unless
 * this run writes it) or whose `schemaVersion` doesn't match, `2` when a
 * component failed to parse, `3` when `check` finds a change at or above
 * `checkLevel`, `4` when `strict` diagnostics exist.
 */
export function resolveExitCode(run: {
  errors: readonly unknown[];
  check?: CheckResult;
  /** From {@link writesCheckSnapshot}. */
  writesSnapshot?: boolean;
  checkLevel?: CheckLevel;
  diagnostics: SveldDiagnostic[];
  strict?: boolean | "errors";
}): ExitCode {
  if (run.check && !run.check.snapshotExists && !run.writesSnapshot) return 1;
  if (run.check?.changes.some((change) => change.kind === "schema")) return 1;
  if (run.errors.length > 0) return 2;
  if (run.check && bumpMeetsLevel(run.check.bump, run.checkLevel ?? "major")) return 3;
  if (failingDiagnostics(run.diagnostics, run.strict).length > 0) return 4;
  return 0;
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

  const { entry: entryOverride, ...runtimeOpts } = opts ?? {};
  const fileConfig = await loadConfig();
  const input = getSvelteEntry(entryOverride ?? fileConfig.entry);
  if (input === null) {
    throw new Error(
      'sveld: could not resolve a Svelte entry point. Set package.json#svelte, or pass the "entry" option.',
    );
  }
  const merged = mergeConfig<SveldRuntimeOptions>(fileConfig, runtimeOpts, { entry: input });
  validateOptions(merged);
  setQuiet(merged.quiet === true);
  const result = await generateBundle(input, merged.glob === true, toGenerateBundleOptions(merged));

  // Read the committed snapshot before `writeOutput` can overwrite it.
  let checkResult: CheckResult | undefined;
  if (merged.check) {
    checkResult = await runCheck(result.components, resolveCheckSnapshotFile(merged), {
      entryExports: result.entryExports,
    });
  }

  await writeOutput(result, merged, input);
  // Persists any generated `.d.ts` text writeOutput just cached, on top of
  // the parse-only save generateBundle() already did.
  result.cache?.save();

  const shouldReport = merged.reportDiagnostics || merged.strict;
  const diagnostics = filterSpeculativeDiagnostics(result.diagnostics, shouldReport);

  if (shouldReport && diagnostics.length > 0) {
    if (merged.format === "json") {
      process.stderr.write(formatDiagnosticsSummaryJson(diagnostics));
    } else {
      console.error(formatDiagnosticsSummary(diagnostics));
    }
  }

  const exitCode = resolveExitCode({
    errors: result.errors,
    check: checkResult,
    writesSnapshot: checkResult ? writesCheckSnapshot(merged, checkResult.snapshotFile) : false,
    checkLevel: merged.checkLevel,
    diagnostics,
    strict: merged.strict,
  });

  const document = buildJsonDocument(result.components, {
    inputDir: dirname(input),
    entryExports: result.entryExports,
    source: merged.jsonOptions?.source,
  });

  return { diagnostics, check: checkResult, errors: result.errors, document, exitCode };
}
