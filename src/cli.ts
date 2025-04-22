import resolve from "@rollup/plugin-node-resolve";
import * as Rollup from "rollup";
import * as svelte from "rollup-plugin-svelte";
import { getSvelteEntry } from "./get-svelte-entry";
import { type PluginSveldOptions, generateBundle, writeOutput } from "./rollup-plugin";

export async function cli(process: NodeJS.Process) {
  const options: PluginSveldOptions = process.argv
    .slice(2)
    .map((arg) => {
      const [flag, value] = arg.split("=");
      const key = flag.slice(2);
      return { [key]: value === undefined ? true : value };
    })
    .reduce((a, c) => ({ ...a, ...c }), {});

  const input = getSvelteEntry() || "src/index.js";
  const rollup_bundle = await Rollup.rollup({
    input,
    plugins: [
      // @ts-ignore
      svelte(),
      resolve(),
    ],
  });

  await rollup_bundle.generate({});

  const result = await generateBundle(input, options?.glob === true);

  writeOutput(result, options, input);
}
