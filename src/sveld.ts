import { formatDiagnosticsSummary, type SveldDiagnostic } from "./diagnostics";
import { getSvelteEntry } from "./get-svelte-entry";
import { loadConfig, mergeConfig } from "./load-config";
import { generateBundle, type PluginSveldOptions, toGenerateBundleOptions, writeOutput } from "./plugin";

interface SveldOptions extends Omit<PluginSveldOptions, "entry"> {
  /**
   * Specify the input to the uncompiled Svelte source.
   * If no value is provided, `sveld` will attempt to infer
   * the entry point from the `package.json#svelte` field.
   */
  input?: string;
  /**
   * Print unresolved-type diagnostics to stderr. Default `false`.
   */
  reportDiagnostics?: boolean;
  /**
   * Exit with code 1 when diagnostics are present. Implies `reportDiagnostics`.
   * Default `false`.
   */
  strict?: boolean;
}

/**
 * Result of a programmatic `sveld` run.
 */
interface SveldResult {
  /** Diagnostics from this run. */
  diagnostics: SveldDiagnostic[];
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
  const { input: inputOverride, strict, reportDiagnostics, ...runtimeOpts } = opts ?? {};
  const fileConfig = await loadConfig();
  const input = getSvelteEntry(inputOverride ?? fileConfig.entry);
  if (input === null) return { diagnostics: [] };
  const merged = mergeConfig<PluginSveldOptions>(fileConfig, runtimeOpts, { entry: input });
  const result = await generateBundle(input, merged.glob === true, toGenerateBundleOptions(merged));
  writeOutput(result, merged, input);

  const { diagnostics } = result;
  const shouldReport = reportDiagnostics || strict;

  if (shouldReport && diagnostics.length > 0) {
    console.warn(formatDiagnosticsSummary(diagnostics));
  }

  if (strict && diagnostics.length > 0) {
    process.exitCode = 1;
  }

  return { diagnostics };
}
