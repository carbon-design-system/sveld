import * as Rollup from "rollup";
import * as fs from "fs";
import * as path from "path";
import * as svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import { generateBundle, PluginSveldOptions, writeOutput } from "./rollup-plugin";

function getSvelteEntry() {
  try {
    const pkg_path = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkg_path, "utf-8"));
    return pkg.svelte;
  } catch (e) {
    process.stderr.write(e + "\n");
    return null;
  }
}

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

  const { output } = await rollup_bundle.generate({});

  // @ts-ignore
  const result = await generateBundle(output, input);

  writeOutput(result, options, input);
}
