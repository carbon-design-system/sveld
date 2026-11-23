// One load as a timeline: every request (when it started and finished, its
// priority, what started it, whether it blocked rendering), the main
// thread's long frames and the idle gaps between them, the page's
// milestones, and when each lazy chunk was ready compared with when the UI
// that needs it became usable. For checking what loads when: whether idle
// prefetching competes with critical work, and whether a chunk lands before
// someone could reach for it.
// Usage: bun run perf:timeline -- [url] [--throttle mobile|desktop|none]
import { config, READY, READY_LABEL, READY_TIME } from "./_config";
import { cdpData, ms, openView, parseArgs, settle, shortUrl, waitFor } from "./_shared";

const { url, throttle } = parseArgs();
const WIDTH = 50;

const observe = `
  window.__timeline = { frames: [], idle: [], fcp: undefined, lcp: undefined };
  const t = window.__timeline;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") t.fcp = e.startTime; })
    .observe({ type: "paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) t.lcp = e.startTime; })
    .observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) t.frames.push([e.startTime, e.duration]); })
    .observe({ type: "long-animation-frame", buffered: true });
  // When idle callbacks actually run, which is when idle-time work starts.
  const ric = window.requestIdleCallback;
  if (ric) window.requestIdleCallback = (fn, opts) => ric((deadline) => { t.idle.push(performance.now()); return fn(deadline); }, opts);
`;

type Request = { initiator: string; priority: string; blocking: string };
type Resource = { name: string; start: number; end: number; bytes: number; blocking: string };
type Timeline = {
  frames: [number, number][];
  idle: number[];
  fcp?: number;
  lcp?: number;
  ready?: number;
  load: number;
  resources: Resource[];
};

await using view = await openView(throttle, { initScript: observe });
const requests = new Map<string, Request>();
view.addEventListener("Network.requestWillBeSent", (event) => {
  const data = cdpData<{
    request: { url: string; initialPriority: string; renderBlockingBehavior?: string };
    initiator: { type: string; url?: string; stack?: unknown };
    type?: string;
  }>(event);
  if (requests.has(data.request.url)) return;
  const { initiator } = data;
  // A script initiator with a stack is a dynamic import or code-built <link>.
  const by = initiator.type === "parser" ? "HTML" : initiator.type === "script" ? "script" : initiator.type;
  requests.set(data.request.url, {
    initiator: data.type === "Other" && by === "script" ? "script (prefetch)" : by,
    priority: data.request.initialPriority,
    blocking: data.request.renderBlockingBehavior ?? "",
  });
});
await view.navigate(url);
await waitFor(view, READY);
await settle(view);
const t = await view.evaluate<Timeline>(`({
  ...window.__timeline,
  ready: ${READY_TIME},
  load: performance.getEntriesByType("navigation")[0]?.loadEventEnd ?? 0,
  resources: [
    { name: location.href, start: 0, end: performance.getEntriesByType("navigation")[0].responseEnd, bytes: performance.getEntriesByType("navigation")[0].transferSize, blocking: "" },
    ...performance.getEntriesByType("resource").map((r) => ({ name: r.name, start: r.startTime, end: r.responseEnd, bytes: r.transferSize, blocking: r.renderBlockingStatus })),
  ],
})`);

const end = Math.max(...t.resources.map((r) => r.end), ...t.frames.map(([s, d]) => s + d), t.ready ?? 0);
const col = (time: number) => Math.min(WIDTH - 1, Math.floor((time / end) * WIDTH));
const bar = (from: number, to: number, mark = "█") => {
  const row = Array(WIDTH).fill("·");
  for (let i = col(from); i <= col(to); i++) row[i] = mark;
  return row.join("");
};
const NAME = 34;
const short = (name: string) => {
  const path = shortUrl(name, "(document)");
  return path.length > NAME ? `…${path.slice(-(NAME - 1))}` : path;
};
const page = new URL(url).origin;
// Cross-origin responses without Timing-Allow-Origin report no size.
const size = (r: Resource) => (r.bytes || r.name.startsWith(page) ? `${(r.bytes / 1000).toFixed(1)} kB` : "?");

console.log(`${url} — ${throttle} throttling, one load, ${Math.round(end)} ms shown\n`);
const milestones = [
  ["FCP", t.fcp],
  ["LCP", t.lcp],
  [READY_LABEL, t.ready],
  ["load", t.load],
  ["first idle callback", t.idle[0]],
] as const;
for (const [name, time] of milestones) {
  if (time === undefined) continue;
  const row = Array(WIDTH).fill(" ");
  row[col(time)] = "|";
  console.log(`  ${row.join("")}  ${name.padEnd(20)}${ms(time)}`);
}
console.log();
for (const r of t.resources.sort((a, b) => a.start - b.start)) {
  const info = requests.get(r.name);
  const blocking = r.blocking === "blocking" ? " blocking" : "";
  console.log(
    `  ${bar(r.start, r.end)}  ${short(r.name).padEnd(NAME)}${ms(r.start).padStart(8)} → ${ms(r.end).padEnd(8)}${size(r).padStart(9)}  ${info?.priority ?? ""} ${info?.initiator ?? ""}${blocking}`,
  );
}
const busy = Array(WIDTH).fill("·");
for (const [start, duration] of t.frames) for (let i = col(start); i <= col(start + duration); i++) busy[i] = "▓";
console.log(
  `  ${busy.join("")}  main thread: ${t.frames.length} long frames, ${ms(t.frames.reduce((s, [, d]) => s + d, 0))}`,
);

// Idle gaps: time between long frames after the ready mark, where idle work fits.
if (t.ready !== undefined) {
  const after = t.frames.filter(([s, d]) => s + d > (t.ready ?? 0)).sort((a, b) => a[0] - b[0]);
  let cursor = t.ready;
  const gaps: [number, number][] = [];
  for (const [s, d] of after) {
    if (s - cursor > 50) gaps.push([cursor, s]);
    cursor = Math.max(cursor, s + d);
  }
  const lastNetwork = Math.max(...t.resources.map((r) => r.end));
  console.log(
    `\n  after ${READY_LABEL}: ${after.length} long frames; network done at ${ms(lastNetwork)}${gaps.length ? `; idle gaps over 50 ms: ${gaps.map(([a, b]) => `${ms(a)}–${ms(b)}`).join(", ")}` : ""}`,
  );

  console.log(`\n  lazy chunks against the UI that needs them (usable at ${READY_LABEL})`);
  for (const { ui, chunk } of config.lazyUI ?? []) {
    const r = t.resources.find((res) => chunk.test(res.name));
    if (!r) {
      console.log(`    ${ui.padEnd(30)} not loaded by the time the page settled`);
      continue;
    }
    const lead = t.ready - r.end;
    const verdict = lead >= 0 ? `ready ${ms(lead)} before` : `ready ${ms(-lead)} after: a fast user waits`;
    console.log(`    ${ui.padEnd(30)} ${short(r.name).padEnd(30)} ${verdict}`);
  }
}
