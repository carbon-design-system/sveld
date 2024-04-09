import pkg from "./package.json";
import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import sveld from "sveld";

const production = !process.env.ROLLUP_WATCH;

export default {
  input: "src",
  output: { format: "es", file: pkg.module },
  plugins: [
    svelte(),
    resolve(),
    production &&
      sveld({
        typesOptions: {
          preamble: `// TypeScript definitions for ${pkg.name}@${pkg.version}\n\n`,
        },
        markdown: true,
        markdownOptions: {
          onAppend: (type, document, components) => {
            if (type === "h1")
              document.append(
                "quote",
                `${components.size} components exported from ${pkg.name}@${pkg.version}.`
              );
          },
        },
        json: true,
      }),
  ],
};
