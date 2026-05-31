import { type SveldOptions as BaseSveldOptions, createSveld } from "./SveldDocumenter";

interface SveldOptions extends BaseSveldOptions {
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
  return createSveld().write(opts);
}
