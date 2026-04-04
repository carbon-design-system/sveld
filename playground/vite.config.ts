import { svelte } from "@sveltejs/vite-plugin-svelte";
import { optimizeCss, optimizeImports } from "carbon-preprocess-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    svelte({
      preprocess: [optimizeImports()],
    }),
    optimizeCss(),
  ],
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
