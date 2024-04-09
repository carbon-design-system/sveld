import pkg from "./package.json";
import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import sveld from "sveld";

const production = !process.env.ROLLUP_WATCH;

export default {
  input: pkg.svelte,
  output: { format: "es", file: pkg.module },
  plugins: [
    svelte(),
    resolve(),
    production &&
      sveld({
        markdown: true,
        markdownOptions: {
          onAppend: (type, document, components) => {
            if (type === "h1")
              document.append("quote", `${components.size} component exported from ${pkg.name}@${pkg.version}.`);
          },
        },
        json: true,
      }),
  ],
};
