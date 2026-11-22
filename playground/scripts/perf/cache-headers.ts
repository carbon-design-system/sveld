// Checks the caching headers of a deployed page and every asset it can load:
// what index.html links, and what those files reference in turn (lazy
// chunks, fonts, icons). A content-hashed asset should be cached for a year
// and marked immutable; the HTML should revalidate, so a deploy shows up.
// Only same-origin files: fonts from a CDN follow that CDN's headers.
// Exits 1 if any file fails.
// Usage: bun run perf:cache -- [url]
import { parseArgs } from "./_shared";
import { IMMUTABLE } from "./serve";

const { url } = parseArgs();
const page = new URL(url);

// `assets/name-[hash].ext`, quoted or in `url()`, absolute or relative.
const ASSET = /(?:^|["'(\s,])\.?\/?(assets\/[\w.-]+\.\w+)/g;
// Vite's `name-[hash].ext`: an 8-character hash before the extension.
const HASH = /-[\w-]{8}\.\w+$/;
const TEXT = /\.(js|css|svg|html|json)$/;
const MAX_AGE = /max-age=(\d+)/;
const YEAR = 31_536_000;
// Long enough that a deploy goes unseen for a while.
const STALE = 3600;

type Row = { path: string; cacheControl: string; encoding: string; edge: string; verdict: string; why: string };

async function check(path: string, document: boolean): Promise<{ row: Row; body: string }> {
  const response = await fetch(new URL(path, page), { headers: { "accept-encoding": "br, gzip" } });
  const cacheControl = response.headers.get("cache-control") ?? "";
  const encoding = response.headers.get("content-encoding") ?? "";
  const edge = response.headers.get("cf-cache-status") ?? "";
  const body = TEXT.test(path) || document ? await response.text() : "";
  if (!(TEXT.test(path) || document)) await response.arrayBuffer();
  const maxAge = Number(cacheControl.match(MAX_AGE)?.[1] ?? 0);
  const problems: string[] = [];
  let fail = false;
  if (!response.ok) {
    problems.push(`HTTP ${response.status}`);
    fail = true;
  } else if (document) {
    if (cacheControl.includes("immutable") || maxAge >= STALE) {
      problems.push("cached too long: a deploy stays hidden");
      fail = true;
    }
  } else if (HASH.test(path)) {
    if (maxAge < YEAR) {
      problems.push(`hashed but max-age=${maxAge}: every visit asks again`);
      fail = true;
    } else if (!cacheControl.includes("immutable")) problems.push("no immutable: a reload revalidates");
  }
  if (response.ok && (TEXT.test(path) || document) && !encoding) problems.push("not compressed");
  const verdict = fail ? "FAIL" : problems.length ? "warn" : "ok";
  return { row: { path, cacheControl, encoding, edge, verdict, why: problems.join("; ") }, body };
}

const rows: Row[] = [];
const seen = new Set<string>();
const queue: string[] = [];
const enqueue = (text: string) => {
  for (const [, path] of text.matchAll(ASSET)) {
    const absolute = `/${path}`;
    if (!seen.has(absolute)) {
      seen.add(absolute);
      queue.push(absolute);
    }
  }
};

const html = await check(page.pathname, true);
rows.push(html.row);
enqueue(html.body);
while (queue.length) {
  // Fetch what's queued together; each answer may queue more.
  const batch = queue.splice(0);
  for (const { row, body } of await Promise.all(batch.map((path) => check(path, false)))) {
    rows.push(row);
    enqueue(body);
  }
}

const width = Math.max(...rows.map((r) => r.path.length));
const cc = Math.max(...rows.map((r) => r.cacheControl.length), 13);
console.log(`${page.href} — ${rows.length} files\n`);
console.log(
  `  ${"".padEnd(5)}${"path".padEnd(width + 2)}${"cache-control".padEnd(cc + 2)}${"enc".padEnd(6)}${"edge".padEnd(9)}`,
);
for (const r of rows) {
  console.log(
    `  ${r.verdict.padEnd(5)}${r.path.padEnd(width + 2)}${r.cacheControl.padEnd(cc + 2)}${r.encoding.padEnd(6)}${r.edge.padEnd(9)}${r.why}`,
  );
}
const failed = rows.filter((r) => r.verdict === "FAIL").length;
if (failed) {
  console.log(`\n${failed} failed. For hashed assets, send \`Cache-Control: ${IMMUTABLE}\`.`);
  process.exitCode = 1;
}
