// Bundles index.html into dist/, prerenders the page into it, and inlines
// its pruned CSS, so the first paint needs no second request.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { styleText } from "node:util";
import { page } from "bun-plugin-page";
import { optimizeCarbonBun } from "carbon-preprocess-svelte";
import { svelte } from "svelte-bun";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
/** Bun's content hash in an output's name, as `[name]-[hash]` writes it. */
const HASH = /-[a-z0-9]{8}(?=\.)/;
const STYLE = /<style[^>]*>([\s\S]*?)<\/style>/g;
const KB = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TYPE_COLOR: Record<string, "green" | "magenta" | "cyan"> = { ".html": "green", ".css": "magenta", ".js": "cyan" };

async function render() {
  const outdir = await mkdtemp(join(tmpdir(), "sveld-playground-ssr-"));
  try {
    // Silent: the client build reports the same rewrites.
    const carbon = optimizeCarbonBun({ root, optimizeComponents: { silent: true }, optimizeCss: false });
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
await rm(dist, { recursive: true, force: true });
await Bun.build({
  entrypoints: [join(root, "index.html")],
  outdir: dist,
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

const ms = Math.round(performance.now());
const time = ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
console.log(`\n${await listDist()}\n${styleText("green", "✓")} Built dist/ in ${time}`);

/** dist/'s files, the page first, then largest first, with a total, in aligned columns. */
async function listDist() {
  // styleText colors only a terminal, after NO_COLOR and FORCE_COLOR.
  const dim = (text: string) => styleText("dim", text);
  const kb = (bytes: number) => `${KB.format(bytes / 1000)} kB`;
  const row = (text: string, label: string, data: string | Uint8Array) => ({
    text,
    label,
    size: typeof data === "string" ? Buffer.byteLength(data) : data.length,
    gzip: Bun.gzipSync(data).length,
  });

  const files = await Promise.all(
    [...new Bun.Glob("**/*").scanSync(dist)].map(async (path) => {
      const slash = path.lastIndexOf("/") + 1;
      // Colored by type, as Vite lists its output.
      const color = TYPE_COLOR[extname(path)];
      const base = path.slice(slash).replace(HASH, dim);
      const name = color ? styleText(color, base) : base;
      const label = dim(path.slice(0, slash)) + name;
      return row(path, label, await Bun.file(join(dist, path)).bytes());
    }),
  );
  files.sort((a, b) => Number(b.text === "index.html") - Number(a.text === "index.html") || b.size - a.size);

  // The page holds the CSS bun-plugin-page inlined.
  const html = await Bun.file(join(dist, "index.html")).text();
  const css = [...html.matchAll(STYLE)].map((match) => match[1]).join("");
  const rows = [files[0], row("└ inline <style>", dim("└ inline <style>"), css), ...files.slice(1)];
  const label = `${files.length} files`;
  const total = {
    text: label,
    label: styleText("bold", label),
    size: files.reduce((sum, file) => sum + file.size, 0),
    gzip: files.reduce((sum, file) => sum + file.gzip, 0),
  };

  const all = [...rows, total];
  const width = (cell: (r: (typeof all)[number]) => string) => Math.max(...all.map((r) => cell(r).length));
  const w = { text: width((r) => r.text), size: width((r) => kb(r.size)), gzip: width((r) => kb(r.gzip)) };
  const numbers = (r: (typeof all)[number]) =>
    `${kb(r.size).padStart(w.size)}  ${dim("gzip")} ${kb(r.gzip).padStart(w.gzip)}`;
  const line = (r: (typeof all)[number]) => `  ${r.label}${" ".repeat(w.text - r.text.length)}  ${numbers(r)}`;
  const rule = "─".repeat(w.size + 2 + "gzip ".length + w.gzip);
  return [styleText("bold", "dist/"), ...rows.map(line), `  ${" ".repeat(w.text + 2)}${dim(rule)}`, line(total)].join(
    "\n",
  );
}
