import * as Rollup from "rollup";
import * as path from "path";
import * as svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import { generateBundle, PluginSveldOptions, writeOutput } from "./rollup-plugin";

export async function cli(process: NodeJS.Process) {
  const options: PluginSveldOptions = process.argv
    .slice(2)
    .map((arg) => {
      const [flag, value] = arg.split("=");
      const key = flag.slice(2);
      return { [key]: value === undefined ? true : value };
    })
    .reduce((a, c) => ({ ...a, ...c }), {});

  const rollup_bundle = await Rollup.rollup({
    input: path.join(process.cwd(), "src/index.js"),
    plugins: [
      // @ts-ignore
      svelte(),
      resolve(),
    ],
  });

  const { output } = await rollup_bundle.generate({});

  // @ts-ignore
  const result = await generateBundle(output);

  writeOutput(result, options);
}
