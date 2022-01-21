import { getSvelteEntry } from "./get-svelte-entry";
import { PluginSveldOptions, generateBundle, writeOutput } from "./rollup-plugin";

export async function sveld(opts?: PluginSveldOptions) {
  const input = getSvelteEntry();
  if (input === null) return;
  const result = await generateBundle(input, opts?.glob === true);
  writeOutput(result, opts || {}, input);
}
