import resolve from "@rollup/plugin-node-resolve";
import svelte from "rollup-plugin-svelte";
import sveld from "sveld";
import pkg from "./package.json";

const production = !process.env.ROLLUP_WATCH;

export default {
  input: "index.js",
  output: { format: "es", file: pkg.module },
  plugins: [svelte(), resolve(), production && sveld({})],
};
