import { svelte } from "@sveltejs/vite-plugin-svelte";
import { optimizeImports } from "carbon-preprocess-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    svelte({
      preprocess: [optimizeImports()],
    }),
  ],
  optimizeDeps: {
    exclude: ["carbon-components-svelte"],
  },
});
