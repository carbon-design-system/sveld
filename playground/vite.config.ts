import { svelte } from "@sveltejs/vite-plugin-svelte";
import { optimizeComponents, optimizeCss, optimizeImports } from "carbon-preprocess-svelte";
import { defineConfig, type Plugin } from "vite";

/**
 * App imports the parser dynamically so it can render first, but the
 * output needs it, so start downloading it alongside the entry.
 */
function preloadParser(): Plugin {
  return {
    name: "preload-parser",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, { bundle }) {
        const chunk = Object.values(bundle ?? {}).find(
          (output) => output.type === "chunk" && output.facadeModuleId?.endsWith("/playground/src/parser.ts"),
        );
        if (!chunk) return [];
        return [
          {
            tag: "link",
            attrs: { rel: "modulepreload", crossorigin: true, href: `/${chunk.fileName}` },
            injectTo: "head",
          },
        ];
      },
    },
  };
}

export default defineConfig({
  plugins: [
    optimizeComponents(),
    svelte({ preprocess: [optimizeImports()] }),
    optimizeCss({ propAware: true }),
    preloadParser(),
  ],
  optimizeDeps: {
    exclude: ["carbon-components-svelte", "carbon-icons-svelte"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("carbon-components-svelte")) return "carbon";
        },
      },
    },
  },
});
