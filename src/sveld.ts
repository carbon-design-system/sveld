import { getSvelteEntry } from "./get-svelte-entry";
import { generateBundle, type PluginSveldOptions, writeOutput } from "./rollup-plugin";

interface SveldOptions extends PluginSveldOptions {
  /**
   * Specify the input to the uncompiled Svelte source.
   * If no value is provided, `sveld` will attempt to infer
   * the entry point from the `package.json#svelte` field.
   */
  input?: string;
}

/**
 * Main entry point for programmatic sveld usage.
 *
 * Generates component documentation from Svelte source files and writes
 * output files based on the provided options. Can be used as a library
 * in addition to the CLI interface.
 *
 * @param opts - Options for generating documentation
 * @returns A promise that resolves when documentation generation is complete
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
export async function sveld(opts?: SveldOptions) {
  const input = getSvelteEntry(opts?.input);
  if (input === null) return;
  const result = await generateBundle(input, opts?.glob === true);
  writeOutput(result, opts || {}, input);
}
