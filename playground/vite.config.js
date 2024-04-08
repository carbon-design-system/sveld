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
});
