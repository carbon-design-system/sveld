import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { optimizeImports } from "carbon-preprocess-svelte";

export default defineConfig({
  root: "playground",
  plugins: [
    svelte({
      preprocess: [optimizeImports()],
    }),
  ],
  optimizeDeps: {
    include: ["highlight.js", "highlight.js/lib/core"],
  },
});
