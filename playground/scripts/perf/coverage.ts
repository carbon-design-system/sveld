// How much of each script and stylesheet the page runs: bytes used by the
// ready mark, after the page idles, and (with --interact) after the
// scripted interactions in perf.config.ts (`steps`). Lists the largest functions that never
// ran, the candidates to split out or drop.
// Usage: bun run perf:coverage -- [url] [--interact] [--throttle none|desktop|mobile]
// Function names are only readable in an unminified build (see profile.ts).
// Unused is not removable: code and CSS for states the run never reached (an
// open menu, a loading spinner, a copy tooltip, an invalid field) count as
// unused too. Before cutting, check what optimizeComponents({ report: true })
// and optimizeCss already prune, and what the app can render.
import { cdpData } from "./_vitals";
import { config, need, READY, READY_LABEL } from "./_config";
import { openView, parseArgs, waitFor } from "./_shared";

const { url, throttle, flags } = parseArgs(undefined, { throttle: "none" });
const TOP = 15;
const ORIGIN = /^https?:\/\/[^/]+\//;
// An innermost rule: a selector and a body with no nested braces.
const RULE = /([^{}]+)\{[^{}]*\}/g;
// The configured block (`cssBlock`), else the first class.
const BLOCK = config.cssBlock;
const FIRST_CLASS = /\.([\w-]+)/;

type Range = { startOffset: number; endOffset: number; count: number };
type ScriptCoverage = { scriptId: string; url: string; functions: { functionName: string; ranges: Range[] }[] };
type RuleUsage = { styleSheetId: string; startOffset: number; endOffset: number; used: boolean };
type Sheet = { styleSheetId: string; sourceURL: string; isInline: boolean; length: number };

/** Per file: its size and, per phase, bytes run or matched (undefined before it loaded). */
type File = { name: string; kind: "JS" | "CSS"; size: number; used: Uint8Array; byPhase: (number | undefined)[] };
const files = new Map<string, File>();
const phases: string[] = [];
const neverCalled = new Map<string, { name: string; file: string; size: number }>();

const short = (src: string) => src.replace(ORIGIN, "") || "(inline)";
const usedBytes = (mask: Uint8Array) => mask.reduce((sum, byte) => sum + byte, 0);

function file(key: string, name: string, kind: File["kind"], size: number) {
  let entry = files.get(key);
  if (!entry) {
    entry = { name, kind, size, used: new Uint8Array(size), byPhase: Array(phases.length - 1).fill(undefined) };
    files.set(key, entry);
  }
  return entry;
}

await using view = await openView(throttle);
const sheets = new Map<string, Sheet>();
view.addEventListener("CSS.styleSheetAdded", (event) => {
  const { header } = cdpData<{ header: Sheet }>(event);
  sheets.set(header.styleSheetId, header);
});
const sources = new Map<string, number>();
view.addEventListener("Debugger.scriptParsed", (event) => {
  const data = cdpData<{ scriptId: string; endOffset?: number; length?: number }>(event);
  sources.set(data.scriptId, data.length ?? data.endOffset ?? 0);
});
await view.cdp("Debugger.enable");
await view.cdp("Profiler.enable");
await view.cdp("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
await view.cdp("DOM.enable");
await view.cdp("CSS.enable");
await view.cdp("CSS.startRuleUsageTracking");

async function snapshot(phase: string) {
  phases.push(phase);
  // Taking coverage resets V8's counters, so each snapshot adds to the masks.
  const { result } = await view.cdp<{ result: ScriptCoverage[] }>("Profiler.takePreciseCoverage");
  for (const script of result) {
    if (!script.url || script.url.startsWith("chrome") || !(sources.get(script.scriptId) ?? 0)) continue;
    const size = sources.get(script.scriptId) ?? 0;
    const entry = file(`js:${script.url}`, short(script.url), "JS", size);
    // Outer ranges first, so a nested range's count overrides its parent's.
    const ranges = script.functions
      .flatMap((f) => f.ranges)
      .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
    const mask = new Uint8Array(size);
    for (const r of ranges) mask.fill(r.count > 0 ? 1 : 0, r.startOffset, Math.min(r.endOffset, size));
    for (let i = 0; i < size; i++) entry.used[i] ||= mask[i] as number;
    for (const f of script.functions) {
      const [whole] = f.ranges;
      if (!whole) continue;
      const key = `${script.url}:${whole.startOffset}`;
      if (whole.count > 0) neverCalled.delete(key);
      else if (phases.length === 1 || neverCalled.has(key)) {
        neverCalled.set(key, {
          name: f.functionName || "(anonymous)",
          file: short(script.url),
          size: whole.endOffset - whole.startOffset,
        });
      }
    }
  }
  const { coverage } = await view.cdp<{ coverage: RuleUsage[] }>("CSS.takeCoverageDelta");
  for (const rule of coverage) {
    const sheet = sheets.get(rule.styleSheetId);
    if (!sheet) continue;
    const name = sheet.sourceURL && !sheet.isInline ? short(sheet.sourceURL) : "inline <style>";
    const entry = file(`css:${rule.styleSheetId}`, name, "CSS", sheet.length);
    if (rule.used) entry.used.fill(1, rule.startOffset, Math.min(rule.endOffset, sheet.length));
  }
  for (const entry of files.values()) entry.byPhase.push(usedBytes(entry.used));
}

await view.navigate(url);
await waitFor(view, READY);
await snapshot(READY_LABEL);
await Bun.sleep(3000);
await snapshot("idle");
if (flags.has("interact")) {
  for (const step of need(config.steps, "steps", "perf:coverage --interact")) {
    await step.run(view);
    await Bun.sleep(500);
  }
  await snapshot("interact");
}

const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;
const pct = (used: number | undefined, size: number) =>
  used === undefined || !size ? "—" : `${Math.round((used / size) * 100)}%`;
const rows = [...files.values()]
  .filter((f) => f.size > 0)
  .sort((a, b) => b.size - (b.byPhase.at(-1) ?? 0) - (a.size - (a.byPhase.at(-1) ?? 0)));

console.log(`${url} — ${throttle} throttling, used bytes (uncompressed)\n`);
console.log(
  `  ${"".padEnd(4)}${"size".padStart(10)}${phases.map((p) => p.padStart(10)).join("")}${"unused".padStart(10)}  file`,
);
for (const f of rows) {
  const last = f.byPhase.at(-1) ?? 0;
  const cols = f.byPhase.map((used) => pct(used, f.size).padStart(10)).join("");
  console.log(`  ${f.kind.padEnd(4)}${kb(f.size).padStart(10)}${cols}${kb(f.size - last).padStart(10)}  ${f.name}`);
}
for (const kind of ["JS", "CSS"] as const) {
  const of = rows.filter((f) => f.kind === kind);
  // Each phase's share counts only the files loaded by then.
  const cols = phases
    .map((_, i) => {
      const loaded = of.filter((f) => f.byPhase[i] !== undefined);
      return pct(
        loaded.reduce((s, f) => s + (f.byPhase[i] ?? 0), 0),
        loaded.reduce((s, f) => s + f.size, 0),
      ).padStart(10);
    })
    .join("");
  const size = of.reduce((s, f) => s + f.size, 0);
  const unused = of.reduce((s, f) => s + f.size - (f.byPhase.at(-1) ?? 0), 0);
  console.log(`  ${kind.padEnd(4)}${kb(size).padStart(10)}${cols}${kb(unused).padStart(10)}  total`);
}

// Outermost functions that never ran: nested ones would double count.
const uncalled = [...neverCalled.entries()]
  .map(([key, f]) => ({
    ...f,
    start: Number(key.slice(key.lastIndexOf(":") + 1)),
    url: key.slice(0, key.lastIndexOf(":")),
  }))
  .sort((a, b) => b.size - a.size);
const outermost = uncalled.filter(
  (f, _, all) =>
    !all.some((o) => o !== f && o.url === f.url && o.start < f.start && o.start + o.size >= f.start + f.size),
);
// Unused CSS by the block its selectors style.
const blocks = new Map<string, number>();
for (const [key, f] of files) {
  if (f.kind !== "CSS") continue;
  const { text } = await view.cdp<{ text: string }>("CSS.getStyleSheetText", { styleSheetId: key.slice(4) });
  for (const match of text.matchAll(RULE)) {
    const start = match.index ?? 0;
    let unused = 0;
    for (let i = start; i < start + match[0].length && i < f.size; i++) unused += f.used[i] ? 0 : 1;
    if (!unused) continue;
    const selector = (match[1] as string).trim();
    const found = BLOCK?.exec(selector) ?? FIRST_CLASS.exec(selector);
    // Rule tracking never marks a font face used; see the font line below.
    const block = selector.startsWith("@font-face")
      ? "@font-face (not tracked)"
      : found
        ? `.${found[1]}`
        : selector.includes("[theme")
          ? "[theme=…]"
          : selector.startsWith(":root")
            ? ":root"
            : "(element selectors)";
    blocks.set(block, (blocks.get(block) ?? 0) + unused);
  }
}
console.log(`\n  unused CSS by block (${phases.at(-1)})`);
for (const [block, n] of [...blocks].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
  console.log(`  ${kb(n).padStart(10)}  ${block}`);
}

const fonts = await view.evaluate<{ declared: number; loaded: string[] }>(`(() => {
  const faces = [...document.fonts];
  return {
    declared: faces.length,
    loaded: faces.filter((f) => f.status === "loaded").map((f) => f.family + " " + f.weight + (f.style === "normal" ? "" : " " + f.style)),
  };
})()`);
console.log(
  `\n  font faces   ${fonts.loaded.length} of ${fonts.declared} declared were loaded: ${[...new Set(fonts.loaded)].join(", ")}`,
);

console.log(`\n  largest functions that never ran (${phases.at(-1)})`);
for (const f of outermost.slice(0, TOP)) console.log(`  ${kb(f.size).padStart(10)}  ${f.name}  ${f.file}`);
console.log("\n  Unused is not dead: states this run never reached count too (see the header).");
