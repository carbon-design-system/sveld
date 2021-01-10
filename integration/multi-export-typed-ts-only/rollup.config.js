import pkg from "./package.json";
import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import sveld from "sveld";

const production = !process.env.ROLLUP_WATCH;

export default {
  input: "index.js",
  output: { format: "es", file: pkg.module },
  plugins: [
    svelte(),
    resolve(),
    production && sveld(),
  ],
};
