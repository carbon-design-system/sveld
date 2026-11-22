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

/** Lazy chunks UI can reach right after hydration: preloaded with the page. */
const SOON = ["/playground/src/TabJson.svelte", "/playground/src/TabMarkdown.svelte"];
/** Lazy chunks only editing needs: prefetched once the page has hydrated. */
const LATER = ["/playground/src/parser.ts"];

/**
 * Schedule the lazy chunks. The output tabs are usable as soon as the page
 * hydrates, so their small chunks are preloaded with the page, at low
 * priority so they yield to the chunks the first render needs; waiting for
 * an idle callback left a spinner for a click right after hydration. The
 * parser is prefetched at the first idle moment after hydration. A
 * `<link rel="prefetch">` in the HTML would start right away and take
 * bandwidth from the first render, and waiting for `load` also waits for
 * the fonts from IBM's CDN.
 */
function scheduleLazyChunks(): Plugin {
  return {
    name: "schedule-lazy-chunks",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, { bundle }) {
        const chunks = Object.values(bundle ?? {}).filter((output) => output.type === "chunk");
        const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
        const visit = (fileName: string, into: Set<string>) => {
          if (into.has(fileName)) return;
          into.add(fileName);
          for (const imported of byFile.get(fileName)?.imports ?? []) visit(imported, into);
        };
        const loaded = new Set<string>();
        for (const chunk of chunks) if (chunk.isEntry) visit(chunk.fileName, loaded);
        // Each listed chunk with the static imports the page doesn't load already.
        const reach = (paths: string[]) => {
          const found = new Set<string>();
          for (const chunk of chunks) {
            if (paths.some((path) => chunk.facadeModuleId?.endsWith(path))) visit(chunk.fileName, found);
          }
          return [...found].filter((fileName) => !loaded.has(fileName)).map((fileName) => `/${fileName}`);
        };

        const soon = reach(SOON);
        const later = reach(LATER).filter((href) => !soon.includes(href));
        return [
          ...soon.map((href) => ({
            tag: "link",
            attrs: { rel: "modulepreload", crossorigin: true, fetchpriority: "low", href },
            injectTo: "head" as const,
          })),
          ...(later.length
            ? [
                {
                  tag: "script",
                  // On the `hydrated` mark index.ts sets, or on `load` if it never comes.
                  children: `(()=>{let done=false;const go=()=>{if(done)return;done=true;(window.requestIdleCallback||setTimeout)(()=>{for(const href of ${JSON.stringify(later)}){const link=document.createElement("link");link.rel="prefetch";link.as="script";link.crossOrigin="";link.href=href;document.head.append(link)}})};new PerformanceObserver((list,observer)=>{if(list.getEntriesByName("hydrated").length){observer.disconnect();go()}}).observe({type:"mark",buffered:true});addEventListener("load",go)})()`,
                  injectTo: "body" as const,
                },
              ]
            : []),
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

/** The stylesheets `index.html` links, as `[tag, path]`. */
const STYLESHEET_LINK = /<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g;

/**
 * Render the page into index.html after the client build; index.ts
 * hydrates it. The stylesheets go inline, so the first paint doesn't wait
 * for a second request.
 */
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
        let html = await readFile(htmlPath, "utf8");
        const links = [...html.matchAll(STYLESHEET_LINK)];
        const paths = links.map(([, path]) => join(config.build.outDir, path));
        const sheets = await Promise.all(paths.map((path) => readFile(path, "utf8")));
        for (const [i, [link]] of links.entries()) html = html.replace(link, `<style>${sheets[i]}</style>`);
        await Promise.all(paths.map((path) => rm(path)));
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
    scheduleLazyChunks(),
    fontDisplaySwap(),
    prerender(),
  ],
  optimizeDeps: {
    exclude: ["carbon-components-svelte"],
  },
  build: {
    // One stylesheet, which `prerender` inlines: lazy chunks then list no
    // CSS to load, which would fetch it again.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("carbon-components-svelte")) return "carbon";
        },
      },
    },
  },
});
