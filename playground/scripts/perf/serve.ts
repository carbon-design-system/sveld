// Serves a built dist/ like production (Render): gzip, `Cache-Control:
// public, max-age=0` with an ETag, to measure a local build.
// Usage: bun run perf:serve (serves dist/ on :4790), or bun serve.ts <dir> [port]
const root = process.argv[2];
const port = Number(process.argv[3] ?? 4790);
if (!root) throw new Error("usage: bun serve.ts <dist> [port]");

const server = Bun.serve({
  port,
  async fetch(req) {
    let path = new URL(req.url).pathname;
    if (path === "/") path = "/index.html";
    const file = Bun.file(`${root}${path}`);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    const bytes = await file.bytes();
    const etag = `"${Bun.hash(bytes).toString(16)}"`;
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag } });
    return new Response(Bun.gzipSync(bytes), {
      headers: { "content-encoding": "gzip", "content-type": file.type, "cache-control": "public, max-age=0", etag },
    });
  },
});
console.log(`serving ${root} at ${server.url}`);
