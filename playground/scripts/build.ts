// Bundles index.html into dist/, prerenders the page into it, and inlines
// its pruned CSS, so the first paint needs no second request.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { page } from "bun-plugin-page";
import { optimizeCarbonBun } from "carbon-preprocess-svelte";
import { svelte } from "svelte-bun";

const root = join(import.meta.dir, "..");

async function render() {
  const outdir = await mkdtemp(join(tmpdir(), "sveld-playground-ssr-"));
  try {
    const carbon = optimizeCarbonBun({ root, optimizeCss: false });
    const ssr = await Bun.build({
      entrypoints: [join(root, "src/ssr.ts")],
      outdir,
      target: "bun",
      metafile: true,
      throw: true,
      plugins: [carbon, svelte({ root, production: true, side: "server", load: (path) => carbon.load(path) })],
    });
    // Fails if a file outside `content` renders Carbon.
    await carbon.pruneCss({}, ssr);
    const { head, body } = (await import(ssr.outputs[0].path)).default();
    return { head, body };
  } finally {
    await rm(outdir, { recursive: true, force: true });
  }
}

// Renders alongside the client build.
const rendered = render();
const carbon = optimizeCarbonBun({ root, optimizeCss: { fontDisplay: "swap" } });
await rm(join(root, "dist"), { recursive: true, force: true });
await Bun.build({
  entrypoints: [join(root, "index.html")],
  outdir: join(root, "dist"),
  splitting: true,
  minify: true,
  throw: true,
  naming: { chunk: "assets/[name]-[hash].[ext]", asset: "assets/[name]-[hash].[ext]" },
  plugins: [
    carbon,
    svelte({ root, production: true, load: (path) => carbon.load(path) }),
    page({
      inlineCss: { transform: (css, result) => carbon.pruneCss({ ...css }, result) },
      preload: ["src/TabJson.svelte", "src/TabMarkdown.svelte"],
      prefetch: ["src/parser.ts"],
      prerender: () => rendered,
    }),
  ],
});
