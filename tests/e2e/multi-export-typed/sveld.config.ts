import { defineConfig } from "sveld";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  typesOptions: {
    preamble: `// TypeScript definitions for ${pkg.name}@${pkg.version}\n\n`,
    printWidth: 80,
    indexTypes: true,
    // TypedThing imports its `Size` type from a sibling `.ts` file; inlining it means the
    // generated `.d.ts` doesn't need that file to travel alongside it.
    inline: "local",
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
