import { svelte } from "@sveltejs/vite-plugin-svelte";
import { optimizeCss, optimizeImports } from "carbon-preprocess-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte({ preprocess: [optimizeImports()] }), optimizeCss({ experimental: { strict: true } })],
  optimizeDeps: {
    exclude: ["carbon-components-svelte", "carbon-icons-svelte"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("carbon-components-svelte")) return "carbon";
          if (id.includes("svelte/compiler") || id.includes("svelte/src/compiler")) return "svelte-compiler";
        },
      },
    },
  },
});
