import { svelte } from "@sveltejs/vite-plugin-svelte";
import { optimizeCss, optimizeImports } from "carbon-preprocess-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte({ preprocess: [optimizeImports()] }), optimizeCss({ experimental: { strict: true } })],
  optimizeDeps: {
    exclude: ["carbon-components-svelte", "carbon-icons-svelte"],
  },
  build: {
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dep) => !dep.includes("/tab-"));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("carbon-components-svelte")) return "carbon";
          if (id.includes("svelte/compiler") || id.includes("svelte/src/compiler")) return "svelte-compiler";
          if (id.includes("/TabTypeScript") || id.includes("languages/typescript")) return "tab-typescript";
          if (id.includes("/TabMarkdown") || id.includes("languages/markdown")) return "tab-markdown";
          if (id.includes("/TabJson") || id.includes("languages/json")) return "tab-json";
          if (id.includes("/TabCustomElements")) return "tab-custom-elements";
          if (id.includes("/CodeHighlighter")) return "code-highlighter";
        },
      },
    },
  },
});
