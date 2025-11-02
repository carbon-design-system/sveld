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

export async function sveld(opts?: SveldOptions) {
  const input = getSvelteEntry(opts?.input);
  if (input === null) return;
  const result = await generateBundle(input, opts?.glob === true);
  writeOutput(result, opts || {}, input);
}
