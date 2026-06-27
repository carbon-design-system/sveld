import { formatDiagnosticsSummary, type SveldDiagnostic } from "./diagnostics";
import { getSvelteEntry } from "./get-svelte-entry";
import { generateBundle, type PluginSveldOptions, writeOutput } from "./plugin";

interface SveldOptions extends Omit<PluginSveldOptions, "entry"> {
  /**
   * Specify the input to the uncompiled Svelte source.
   * If no value is provided, `sveld` will attempt to infer
   * the entry point from the `package.json#svelte` field.
   */
  input?: string;
  /**
   * Exit with code 1 when diagnostics are present. Default `false`.
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
  const input = getSvelteEntry(opts?.input);
  if (input === null) return { diagnostics: [] };
  const result = await generateBundle(input, opts?.glob === true, { failFast: opts?.failFast });
  writeOutput(result, { ...opts, entry: opts?.input }, input);

  const { diagnostics } = result;
  if (diagnostics.length > 0) {
    console.warn(formatDiagnosticsSummary(diagnostics));

    if (opts?.strict) {
      process.exitCode = 1;
    }
  }

  return { diagnostics };
}
