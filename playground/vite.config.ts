import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { optimizeComponents, optimizeCss, optimizeImports } from "carbon-preprocess-svelte";
import { build, defineConfig, type Plugin, type ResolvedConfig } from "vite";

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

/** Carbon's `font-display: auto` hides text until IBM Plex loads from IBM's CDN. */
function fontDisplaySwap(): Plugin {
  return {
    name: "font-display-swap",
    enforce: "pre",
    // Before the CSS is hashed, so the file name changes with it.
    transform(code, id) {
      if (!id.endsWith("/carbon-components-svelte/css/all.css")) return;
      return code.replaceAll("font-display:auto", "font-display:swap");
    },
  };
}

/** Render the page into index.html after the client build; index.ts hydrates it. */
function prerender(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "prerender",
    apply: (_config, env) => env.command === "build" && !env.isSsrBuild,
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      const outDir = await mkdtemp(join(tmpdir(), "sveld-playground-ssr-"));
      try {
        await build({
          configFile: config.configFile,
          mode: config.mode,
          logLevel: "warn",
          ssr: { noExternal: true },
          build: { ssr: "src/ssr.ts", outDir, emptyOutDir: true },
        });
        const { default: renderPage } = await import(pathToFileURL(join(outDir, "ssr.js")).href);
        const { head, body } = renderPage();
        const htmlPath = join(config.build.outDir, "index.html");
        const html = await readFile(htmlPath, "utf8");
        await writeFile(htmlPath, html.replace("</head>", `${head}</head>`).replace("<body>", `<body>${body}`));
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    optimizeComponents(),
    svelte({ preprocess: [optimizeImports()] }),
    optimizeCss(),
    defaultParsed(),
    prefetchLater(),
    fontDisplaySwap(),
    prerender(),
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
