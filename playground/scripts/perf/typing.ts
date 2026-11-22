// Keystroke-to-paint latency in an editor as its content grows. For each
// size, fills `typing.target` from perf.config.ts with `typing.fill(lines)`
// as a paste over a select-all, timing it to the next paint and until the
// main thread goes quiet. An editor that handles `paste` (most code
// editors) gets the event; otherwise the text goes in through the browser's
// own editing (`insertText`), whose cost is the browser's, not the app's. Then types real keys at the
// end, about 8 a second, and reports each keystroke's latency from Event
// Timing (input delay, processing, presentation) and the long frames during
// typing, which catch work a keystroke schedules for later.
// Usage: bun run perf:typing -- [url] [--runs 1] [--throttle mobile|desktop|none]
import { config, need, READY } from "./_config";
import { median, ms, openView, parseArgs, waitFor } from "./_shared";

const { url, runs, throttle } = parseArgs(undefined, { runs: 1 });
const typing = need(config.typing, "typing", "perf:typing");
const sizes = typing.sizes ?? [10, 100, 1000];
const KEYS = "abcdefghijklmnopqrst".split("");
const GAP = 120;
// The main thread counts as quiet after this long without a long frame.
const QUIET = 500;

const observe = `
  window.__typing = { events: new Map(), frames: [] };
  const t = window.__typing;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.interactionId) continue;
      const prev = t.events.get(e.interactionId);
      if (!prev || e.duration > prev.duration) {
        t.events.set(e.interactionId, {
          duration: e.duration,
          delay: e.processingStart - e.startTime,
          processing: e.processingEnd - e.processingStart,
          presentation: e.startTime + e.duration - e.processingEnd,
        });
      }
    }
  }).observe({ type: "event", durationThreshold: 16, buffered: true });
  new PerformanceObserver((list) => {
    for (const f of list.getEntries()) {
      const top = [...f.scripts].sort((a, b) => b.duration - a.duration)[0];
      t.frames.push([
        f.startTime,
        f.duration,
        f.scripts.reduce((sum, s) => sum + s.duration, 0),
        f.styleAndLayoutStart ? f.startTime + f.duration - f.styleAndLayoutStart : 0,
        top ? (top.sourceFunctionName || "(anonymous)") + " via " + top.invoker : "",
      ]);
    }
  }).observe({ type: "long-animation-frame", buffered: true });
`;

const target = JSON.stringify(typing.target);
// Selects the target's contents (all, or a caret at the end).
const select = (collapse: boolean) => `(() => {
  const el = document.querySelector(${target});
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  ${collapse ? "range.collapse(false);" : ""}
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
})()`;

type Keystroke = { duration: number; delay: number; processing: number; presentation: number };
/** A long frame: start, duration, script time, style and layout time, its top script. */
type Frame = [number, number, number, number, string];
type Row = {
  lines: number;
  paint: number;
  settled: number;
  keys: Keystroke[];
  longFrames: number;
  blocking: number;
  script: number;
  layout: number;
  top: string[];
};
const rows: Row[] = [];
const methods = new Set<string>();

for (const lines of sizes) {
  for (let run = 0; run < runs; run++) {
    await using view = await openView(throttle, { initScript: observe });
    await view.navigate(url);
    await waitFor(view, READY);
    await view.click(typing.target); // focus it, as a person would, first
    await Bun.sleep(2000);

    const text = JSON.stringify(typing.fill(lines));
    await view.evaluate(select(false));
    const { paint, method } = await view.evaluate<{ paint: number; method: string }>(`new Promise((resolve) => {
      const start = performance.now();
      const data = new DataTransfer();
      data.setData("text/plain", ${text});
      const paste = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
      document.activeElement.dispatchEvent(paste);
      // A synthetic paste has no default action: insert it the browser's way.
      const method = paste.defaultPrevented ? "paste" : "insertText";
      if (method === "insertText") document.execCommand("insertText", false, ${text});
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({ paint: performance.now() - start, method })));
    })`);
    methods.add(method);
    const filledAt = await view.evaluate<number>("performance.now()");
    // Settled: no long frame has ended within QUIET of now.
    await waitFor(
      view,
      `(() => { const f = window.__typing.frames.at(-1); return !f || performance.now() - (f[0] + f[1]) > ${QUIET}; })()`,
      60_000,
    );
    const settled = await view.evaluate<number>(
      `(() => { const f = window.__typing.frames.filter(([s]) => s >= ${filledAt - paint}).at(-1); return f ? f[0] + f[1] - ${filledAt - paint} : ${paint}; })()`,
    );
    const got = await view.evaluate<number>(`document.querySelector(${target}).textContent.split("\\n").length`);
    if (Math.abs(got - lines) > 2) console.warn(`  filled ${got} lines, expected ${lines}`);

    await view.evaluate(select(true));
    const typingFrom = await view.evaluate<number>("performance.now()");
    const before = await view.evaluate<number[]>("[...window.__typing.events.keys()]");
    for (const key of KEYS) {
      await view.press(key);
      await Bun.sleep(GAP);
    }
    await Bun.sleep(1000);
    const keys = await view.evaluate<Keystroke[]>(
      `[...window.__typing.events].filter(([id]) => !${JSON.stringify(before)}.includes(id)).map(([, e]) => e)`,
    );
    const frames = await view.evaluate<Frame[]>(`window.__typing.frames.filter(([s]) => s >= ${typingFrom})`);
    rows.push({
      lines,
      paint,
      settled,
      keys,
      longFrames: frames.length / KEYS.length,
      blocking: frames.reduce((sum, [, d]) => sum + Math.max(0, d - 50), 0),
      script: frames.reduce((sum, f) => sum + f[2], 0) / Math.max(1, frames.length),
      layout: frames.reduce((sum, f) => sum + f[3], 0) / Math.max(1, frames.length),
      top: frames.map((f) => f[4]).filter(Boolean),
    });
  }
}

const p95 = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * 0.95))] ?? 0;
console.log(
  `${url} — ${throttle} throttling, filled by ${[...methods].join(" and ")}, ${KEYS.length} keystrokes per size, ${runs} run(s) each\n`,
);
console.log(
  `  ${"lines".padStart(6)}${"fill→paint".padStart(12)}${"settled".padStart(10)}${"key p50".padStart(10)}${"key p95".padStart(10)}${"delay".padStart(8)}${"process".padStart(9)}${"present".padStart(9)}${"long frames/key".padStart(17)}`,
);
for (const lines of sizes) {
  const of = rows.filter((r) => r.lines === lines);
  const keys = of.flatMap((r) => r.keys);
  const pick = (k: keyof Keystroke) => (keys.length ? median(keys.map((e) => e[k])) : undefined);
  console.log(
    `  ${String(lines).padStart(6)}${ms(median(of.map((r) => r.paint))).padStart(12)}${ms(median(of.map((r) => r.settled))).padStart(10)}${ms(pick("duration")).padStart(10)}${ms(keys.length ? p95(keys.map((e) => e.duration)) : undefined).padStart(10)}${ms(pick("delay")).padStart(8)}${ms(pick("processing")).padStart(9)}${ms(pick("presentation")).padStart(9)}${median(
      of.map((r) => r.longFrames),
    )
      .toFixed(2)
      .padStart(17)}`,
  );
}
// Where a size's long frames went, when it had any.
for (const lines of sizes) {
  const of = rows.filter((r) => r.lines === lines && r.top.length);
  if (!of.length) continue;
  const counts = new Map<string, number>();
  for (const name of of.flatMap((r) => r.top)) counts.set(name, (counts.get(name) ?? 0) + 1);
  const [top] = [...counts].sort((a, b) => b[1] - a[1]);
  console.log(
    `  ${lines} lines: each long frame ${ms(median(of.map((r) => r.script)))} script, ${ms(median(of.map((r) => r.layout)))} style and layout; top script ${top?.[0]}`,
  );
}
console.log("\n  key: Event Timing per keystroke (16 ms floor); delay, process and present split its median.");
console.log("  long frames/key: frames over 50 ms during typing, per keystroke; work a keystroke schedules for later.");
