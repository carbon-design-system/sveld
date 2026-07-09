import { defineConfig } from "sveld";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  json: true,
  markdown: true,
  markdownOptions: {
    onAppend: (type, document, components) => {
      if (type === "h1")
        document.append("quote", `${components.size} components exported from ${pkg.name}@${pkg.version}.`);
    },
  },
});
