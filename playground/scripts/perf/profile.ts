// Where a cold load's main-thread time goes: a V8 CPU profile from navigation
// to the page's ready mark (or load), as self and total time per function
// and self time per script.
// Usage: bun run perf:profile -- [url] [--runs 3] [--throttle mobile|desktop|none]
// Function names and lines are only useful in an unminified build:
//   bunx vite build --minify false --outDir /tmp/prof-dist
//   bun scripts/perf/serve.ts /tmp/prof-dist 4791
//   bun run perf:profile -- http://localhost:4791/
import { READY, READY_LABEL } from "./_config";
import { openView, parseArgs, shortUrl, waitFor } from "./_shared";

const { url, runs, throttle } = parseArgs(undefined, { runs: 3 });
const TOP = 25;

type CallFrame = { functionName: string; url: string; lineNumber: number; columnNumber: number };
type ProfileNode = { id: number; callFrame: CallFrame; children?: number[] };
type Profile = { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] };

// V8's pseudo-frames: time not spent in page JavaScript.
const META = new Set(["(root)", "(program)", "(idle)", "(garbage collector)"]);

const self = new Map<string, number>();
const total = new Map<string, number>();
const byScript = new Map<string, number>();
const meta = new Map<string, number>();
const add = (map: Map<string, number>, key: string, n: number) => map.set(key, (map.get(key) ?? 0) + n);
// Built-ins have no URL; the page's own inline scripts have the page's.
const short = (src: string) => (src === "" ? "(native)" : shortUrl(src));

for (let i = 0; i < runs; i++) {
  await using view = await openView(throttle);
  await view.cdp("Profiler.enable");
  await view.cdp("Profiler.setSamplingInterval", { interval: 100 }); // µs
  await view.cdp("Profiler.start");
  await view.navigate(url);
  await waitFor(view, READY);
  const { profile } = await view.cdp<{ profile: Profile }>("Profiler.stop");

  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parent = new Map<number, number>();
  for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
  const key = ({ callFrame: f }: ProfileNode) =>
    `${f.functionName || "(anonymous)"}  ${short(f.url)}${f.url ? `:${f.lineNumber + 1}:${f.columnNumber + 1}` : ""}`;

  // A sample's delta is the time until the next one; charge it to the leaf
  // (self) and once to each distinct function on the stack (total).
  for (const [s, id] of profile.samples.entries()) {
    const ms = (profile.timeDeltas[s + 1] ?? 0) / 1000 / runs;
    const leaf = nodes.get(id);
    if (!leaf) continue;
    if (META.has(leaf.callFrame.functionName)) {
      add(meta, leaf.callFrame.functionName, ms);
      continue;
    }
    add(self, key(leaf), ms);
    add(byScript, short(leaf.callFrame.url), ms);
    const seen = new Set<string>();
    for (let node: ProfileNode | undefined = leaf; node; node = nodes.get(parent.get(node.id) ?? -1)) {
      if (META.has(node.callFrame.functionName) || seen.has(key(node))) continue;
      seen.add(key(node));
      add(total, key(node), ms);
    }
  }
}

const top = (map: Map<string, number>, n = TOP) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
const fmt = (n: number) => `${n.toFixed(1)} ms`.padStart(10);
const js = [...self.values()].reduce((a, b) => a + b, 0);

console.log(`${url} — ${throttle} throttling, mean of ${runs} cold loads until ${READY_LABEL}\n`);
console.log(`  ${"JavaScript".padEnd(20)}${fmt(js)}`);
for (const [name, n] of top(meta)) if (name !== "(root)") console.log(`  ${name.padEnd(20)}${fmt(n)}`);
console.log(`\n  ${"self".padStart(10)}${"total".padStart(10)}  function`);
for (const [name, n] of top(self)) console.log(`  ${fmt(n)}${fmt(total.get(name) ?? 0)}  ${name}`);
console.log(`\n  ${"self".padStart(10)}  script`);
for (const [name, n] of top(byScript, 10)) console.log(`  ${fmt(n)}  ${name}`);
