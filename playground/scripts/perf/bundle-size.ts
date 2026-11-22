// Per-asset raw, gzip and brotli sizes of a build, split into what the first
// load fetches (index.html and what it links) and what loads later.
// Usage: bun run perf:bundle -- [dist] [--base <dist>]
// With --base, adds a delta column; content hashes are ignored when matching
// assets across the two builds.
import { brotliCompressSync, constants } from "node:zlib";

const argv = process.argv.slice(2);
const baseAt = argv.indexOf("--base");
const base = baseAt === -1 ? undefined : argv.splice(baseAt, 2)[1];
const dist = argv[0] ?? "dist";

// `<script src>`, `<link rel=modulepreload|stylesheet|icon href>` in index.html.
const LINKED = /<(?:script[^>]*\ssrc|link[^>]*\srel="?(?:modulepreload|stylesheet|icon)"?[^>]*\shref)="?([^"\s>]+)/g;
const INLINE = /<(style|script)\b[^>]*>([\s\S]*?)<\/\1>/g;
// Vite's `name-[hash].ext`: an 8-character hash before the extension.
const HASH = /-[\w-]{8}(?=\.\w+$)/;
const LEADING_SLASH = /^\.?\//;

type Asset = { raw: number; gzip: number; brotli: number; initial: boolean };

const sizes = (bytes: Uint8Array<ArrayBuffer>) => ({
  raw: bytes.length,
  gzip: Bun.gzipSync(bytes, { level: 9 }).length,
  brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
});

async function measure(root: string) {
  const html = await Bun.file(`${root}/index.html`).text();
  const initial = new Set([...html.matchAll(LINKED)].map((m) => (m[1] as string).replace(LEADING_SLASH, "")));
  const assets = new Map<string, Asset>();
  for await (const path of new Bun.Glob("**/*").scan(root)) {
    const bytes = await Bun.file(`${root}/${path}`).bytes();
    assets.set(path.replace(HASH, ""), { ...sizes(bytes), initial: path === "index.html" || initial.has(path) });
  }
  // What index.html carries inline (the prerendered page aside).
  const inline = [...html.matchAll(INLINE)].map(([, tag, body]) => ({
    tag: tag as string,
    ...sizes(new TextEncoder().encode(body)),
  }));
  return { assets, inline };
}

const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;
const signed = (n: number) => (n === 0 ? "" : `${n > 0 ? "+" : "−"}${kb(Math.abs(n))}`);

const build = await measure(dist);
const before = base ? await measure(base) : undefined;
const keys = new Set([...build.assets.keys(), ...(before?.assets.keys() ?? [])]);
const rows = [...keys]
  .map((key) => ({ key, now: build.assets.get(key), was: before?.assets.get(key) }))
  .sort((x, y) => (y.now?.gzip ?? 0) - (x.now?.gzip ?? 0));

console.log(`${dist}${base ? ` vs ${base}` : ""}\n`);
console.log(
  `  ${"".padEnd(8)}${"raw".padStart(10)}${"gzip".padStart(10)}${"brotli".padStart(10)}${base ? "  Δ gzip" : ""}  asset`,
);
for (const { key, now, was } of rows) {
  const delta = base ? `  ${(now ? signed(now.gzip - (was?.gzip ?? 0)) : "removed").padEnd(8)}` : "";
  const sized = now
    ? `${kb(now.raw).padStart(10)}${kb(now.gzip).padStart(10)}${kb(now.brotli).padStart(10)}`
    : "".padStart(30);
  const load = now?.initial ? "initial" : now ? "lazy" : "";
  console.log(`  ${load.padEnd(8)}${sized}${delta}  ${key}${!was && base ? " (new)" : ""}`);
}

const total = (assets: Map<string, Asset> | undefined, initial: boolean) => {
  const sum = { raw: 0, gzip: 0, brotli: 0 };
  for (const a of assets?.values() ?? []) {
    if (a.initial !== initial) continue;
    sum.raw += a.raw;
    sum.gzip += a.gzip;
    sum.brotli += a.brotli;
  }
  return sum;
};
console.log();
for (const initial of [true, false]) {
  const now = total(build.assets, initial);
  const delta = base ? `  ${signed(now.gzip - total(before?.assets, initial).gzip).padEnd(8)}` : "";
  console.log(
    `  ${(initial ? "initial" : "lazy").padEnd(8)}${kb(now.raw).padStart(10)}${kb(now.gzip).padStart(10)}${kb(now.brotli).padStart(10)}${delta}  total`,
  );
}
for (const { tag, raw, gzip, brotli } of build.inline) {
  if (raw < 100) continue;
  console.log(
    `  ${"".padEnd(8)}${kb(raw).padStart(10)}${kb(gzip).padStart(10)}${kb(brotli).padStart(10)}  inline <${tag}> in index.html`,
  );
}
