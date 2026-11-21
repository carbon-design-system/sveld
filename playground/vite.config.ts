import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { optimizeComponents, optimizeCss, optimizeImports } from "carbon-preprocess-svelte";
import { defineConfig, type Plugin } from "vite";

const DEFAULT_PARSED = "virtual:default-parsed";

/** The dev server exports `null` and parses live, so parser edits show up. */
function defaultParsed(): Plugin {
  let build = false;
  return {
    name: "default-parsed",
    configResolved(config) {
      build = config.command === "build";
    },
    resolveId(id) {
      if (id === DEFAULT_PARSED) return `\0${DEFAULT_PARSED}`;
    },
    load(id) {
      if (id !== `\0${DEFAULT_PARSED}`) return;
      if (!build) return "export default null;";
      // A separate process, so this config doesn't import sveld's source.
      const script = fileURLToPath(new URL("scripts/default-parsed.ts", import.meta.url));
      const json = execFileSync("bun", [script], { encoding: "utf8" });
      return `export default JSON.parse(${JSON.stringify(json)});`;
    },
  };
}

const LATER = ["/playground/src/parser.ts", "/playground/src/TabJson.svelte", "/playground/src/TabMarkdown.svelte"];

/**
 * Prefetch the chunks the page loads later once it has loaded and gone
 * idle. A `<link rel="prefetch">` in the HTML starts right away and
 * takes bandwidth from the chunks the first render needs.
 */
function prefetchLater(): Plugin {
  return {
    name: "prefetch-later",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, { bundle }) {
        const chunks = Object.values(bundle ?? {}).filter((output) => output.type === "chunk");
        const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
        const loaded = new Set<string>();
        const visit = (fileName: string, into: Set<string>) => {
          if (into.has(fileName)) return;
          into.add(fileName);
          for (const imported of byFile.get(fileName)?.imports ?? []) visit(imported, into);
        };
        for (const chunk of chunks) if (chunk.isEntry) visit(chunk.fileName, loaded);

        const later = new Set<string>();
        for (const chunk of chunks) {
          if (LATER.some((path) => chunk.facadeModuleId?.endsWith(path))) visit(chunk.fileName, later);
        }
        const hrefs = [...later].filter((fileName) => !loaded.has(fileName)).map((fileName) => `/${fileName}`);
        if (hrefs.length === 0) return [];
        return [
          {
            tag: "script",
            children: `addEventListener("load",()=>(window.requestIdleCallback||setTimeout)(()=>{for(const href of ${JSON.stringify(hrefs)}){const link=document.createElement("link");link.rel="prefetch";link.as="script";link.crossOrigin="";link.href=href;document.head.append(link)}}))`,
            injectTo: "body" as const,
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
    defaultParsed(),
    prefetchLater(),
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
