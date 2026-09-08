import type { ComponentParseError } from "./bundle";
import { type CheckResult, resolveCheckSnapshotFile, runCheck } from "./check";
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
   * Suggested process exit code for this run, using the same mapping as the
   * CLI (a breaking `check` result wins over `strict` diagnostics): `0` on
   * success, `3` on a breaking API change, `4` when `strict` diagnostics
   * exist. `sveld()` never mutates `process.exitCode` itself; assign this
   * value yourself if you want the process to exit non-zero.
   */
  exitCode: 0 | 3 | 4;
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
  if (!merged.dryRun) result.cache?.save();

  const shouldReport = merged.reportDiagnostics || merged.strict;
  const diagnostics = filterSpeculativeDiagnostics(result.diagnostics, shouldReport);

  if (shouldReport && diagnostics.length > 0) {
    if (merged.format === "json") {
      process.stderr.write(formatDiagnosticsSummaryJson(diagnostics));
    } else {
      console.error(formatDiagnosticsSummary(diagnostics));
    }
  }

  // Lowest applicable code wins (3 beats 4), matching the CLI's exit-code contract.
  let exitCode: 0 | 3 | 4 = 0;

  if (checkResult?.bump === "major") {
    exitCode = 3;
  } else if (failingDiagnostics(diagnostics, merged.strict).length > 0) {
    exitCode = 4;
  }

  return { diagnostics, check: checkResult, errors: result.errors, exitCode };
}
