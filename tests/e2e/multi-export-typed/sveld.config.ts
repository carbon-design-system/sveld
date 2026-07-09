import { defineConfig } from "sveld";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  typesOptions: {
    preamble: `// TypeScript definitions for ${pkg.name}@${pkg.version}\n\n`,
    printWidth: 80,
  },
  json: true,
  markdown: true,
  markdownOptions: {
    onAppend: (type, document, components) => {
      if (type === "h1")
        document.append("quote", `${components.size} components exported from ${pkg.name}@${pkg.version}.`);
    },
  },
});
