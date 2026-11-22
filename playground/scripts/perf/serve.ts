// Serves a built dist/ like production (Render): gzip, `Cache-Control:
// public, max-age=0` with an ETag, to measure a local build. `--immutable`
// serves `/assets/*` with a year-long immutable cache instead, as a Render
// header rule for that path would.
// Usage: bun run perf:serve (serves dist/ on :4790), or
//   bun serve.ts <dir> [port] [--immutable]

const REVALIDATE = "public, max-age=0";
/** Content-hashed: a changed file gets a new name, so it never goes stale. */
export const IMMUTABLE = "public, max-age=31536000, immutable";

/** Serves `root` on `port`; `compare.ts` runs two of these side by side. */
export function serveDist(root: string, port: number, { immutable = false } = {}) {
  return Bun.serve({
    port,
    async fetch(req) {
      let path = new URL(req.url).pathname;
      if (path === "/") path = "/index.html";
      const file = Bun.file(`${root}${path}`);
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      const bytes = await file.bytes();
      const etag = `"${Bun.hash(bytes).toString(16)}"`;
      const cacheControl = immutable && path.startsWith("/assets/") ? IMMUTABLE : REVALIDATE;
      if (req.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers: { etag, "cache-control": cacheControl } });
      }
      return new Response(Bun.gzipSync(bytes), {
        headers: { "content-encoding": "gzip", "content-type": file.type, "cache-control": cacheControl, etag },
      });
    },
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const immutable = args.includes("--immutable");
  const [root, port = "4790"] = args.filter((arg) => !arg.startsWith("--"));
  if (!root) throw new Error("usage: bun serve.ts <dist> [port] [--immutable]");
  const server = serveDist(root, Number(port), { immutable });
  console.log(`serving ${root} at ${server.url}${immutable ? " (/assets/* immutable)" : ""}`);
}
