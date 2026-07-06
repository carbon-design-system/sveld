import { type CheckResult, resolveCheckSnapshotFile, runCheck } from "./check";
import { formatDiagnosticsSummary, type SveldDiagnostic } from "./diagnostics";
import { getSvelteEntry } from "./get-svelte-entry";
import { loadConfig, mergeConfig, type SveldRuntimeOptions } from "./load-config";
import { generateBundle, toGenerateBundleOptions, writeOutput } from "./plugin";

interface SveldOptions extends Omit<SveldRuntimeOptions, "entry"> {
  /**
   * Specify the input to the uncompiled Svelte source.
   * If no value is provided, `sveld` will attempt to infer
   * the entry point from the `package.json#svelte` field.
   */
  input?: string;
}

/**
 * Result of a programmatic `sveld` run.
 */
interface SveldResult {
  /** Diagnostics from this run. */
  diagnostics: SveldDiagnostic[];
  /** Populated when `check` is enabled: the API diff against the committed snapshot. */
  check?: CheckResult;
}

/**
 * Programmatic entry point for sveld.
 *
 * @example
 * ```ts
 * await sveld({
 *   input: "./src",
 *   types: true,
 *   json: true,
 *   markdown: true,
 *   glob: true
 * });
 * ```
 */
export async function sveld(opts?: SveldOptions): Promise<SveldResult> {
  const { input: inputOverride, ...runtimeOpts } = opts ?? {};
  const fileConfig = await loadConfig();
  const input = getSvelteEntry(inputOverride ?? fileConfig.entry);
  if (input === null) {
    throw new Error(
      'sveld: could not resolve a Svelte entry point. Set package.json#svelte, or pass the "input" option.',
    );
  }
  const merged = mergeConfig<SveldRuntimeOptions>(fileConfig, runtimeOpts, { entry: input });
  const result = await generateBundle(input, merged.glob === true, toGenerateBundleOptions(merged));

  // Read the committed snapshot before `writeOutput` can overwrite it.
  let checkResult: CheckResult | undefined;
  if (merged.check) {
    checkResult = await runCheck(result.components, resolveCheckSnapshotFile(merged), {
      entryExports: result.entryExports,
    });
  }

  await writeOutput(result, merged, input);

  const { diagnostics } = result;
  const shouldReport = merged.reportDiagnostics || merged.strict;

  if (shouldReport && diagnostics.length > 0) {
    console.warn(formatDiagnosticsSummary(diagnostics));
  }

  if (merged.strict && diagnostics.length > 0) {
    process.exitCode = 1;
  }

  return { diagnostics, check: checkResult };
}
