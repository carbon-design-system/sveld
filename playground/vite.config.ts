import path from "node:path";
import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { optimizeCss, optimizeImports } from "carbon-preprocess-svelte";
import { defineConfig } from "vite";

const playgroundDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Imports under `../src/` resolve from repo root; pin deps installed here.
      "comment-parser": path.join(playgroundDir, "node_modules/comment-parser"),
      "estree-walker": path.join(playgroundDir, "node_modules/estree-walker"),
    },
  },
  plugins: [svelte({ preprocess: [optimizeImports()] }), optimizeCss({ experimental: { strict: true } })],
  optimizeDeps: {
    exclude: ["carbon-components-svelte"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("carbon-components-svelte")) return "carbon";
          if (id.includes("svelte/compiler") || id.includes("svelte/src/compiler")) return "svelte-compiler";
          if (id.includes("prettier/plugins/typescript") || id.includes("prettier/plugins/estree"))
            return "prettier-ts";
          if (id.includes("prettier/plugins/markdown")) return "prettier-md";
          if (id.includes("prettier/standalone") || (id.includes("prettier") && id.includes("doc.js")))
            return "prettier-core";
        },
      },
    },
  },
});
