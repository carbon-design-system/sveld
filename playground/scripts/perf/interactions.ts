// INP from the browser's Event Timing API, over scripted playground
// interactions: tab switches, picking an example, and typing in the editor.
// Bun.WebView's input is native (isTrusted), so the browser times it as it
// would a person's. Usage: bun run perf:interactions -- [url] [--runs 3] [--throttle mobile|desktop|none]
import { median, ms, openView, parseArgs, waitFor } from "./_shared";

const { url, runs, throttle } = parseArgs(undefined, { runs: 3 });

// Latency per interaction: the longest event entry sharing its interactionId.
const observe = `
  window.__interactions = new Map();
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.interactionId) continue;
      const prev = window.__interactions.get(e.interactionId);
      if (!prev || e.duration > prev.duration) window.__interactions.set(e.interactionId, { name: e.name, start: e.startTime, duration: e.duration });
    }
  }).observe({ type: "event", durationThreshold: 16, buffered: true });
`;

// Each step is one interaction; `label` names it in the report.
const steps: { label: string; run: (view: Bun.WebView) => Promise<unknown> }[] = [
  { label: "JSON tab", run: (v) => v.click(".bx--tabs__nav-item:nth-of-type(2) a") },
  { label: "Markdown tab", run: (v) => v.click(".bx--tabs__nav-item:nth-of-type(3) a") },
  { label: "TypeScript tab", run: (v) => v.click(".bx--tabs__nav-item:nth-of-type(1) a") },
  { label: "open dropdown", run: (v) => v.click(".bx--dropdown") },
  { label: "pick example", run: (v) => v.click(".bx--list-box__menu-item:nth-of-type(5)") },
  { label: "focus editor", run: (v) => v.click(".code-editor code") },
  { label: "type in editor", run: (v) => v.press("Enter") },
];

const perStep: Record<string, number[]> = {};
const inps: number[] = [];
for (let i = 0; i < runs; i++) {
  await using view = await openView(throttle, observe);
  await view.navigate(url);
  // Interactive once the page marks hydration (or after load, if it doesn't).
  await waitFor(view, `performance.getEntriesByName("hydrated").length > 0 || document.readyState === "complete"`);
  await Bun.sleep(2000); // like a person reading first; idle-time work settles
  for (const step of steps) {
    const before = await view.evaluate("[...window.__interactions.keys()]");
    await step.run(view);
    await Bun.sleep(800); // let the response paint so its duration is final
    const added: number[] = await view.evaluate(
      `[...window.__interactions].filter(([id]) => !${JSON.stringify(before)}.includes(id)).map(([, e]) => e.duration)`,
    );
    (perStep[step.label] ??= []).push(added.length ? Math.max(...added) : 0);
  }
  const all: number[] = await view.evaluate("[...window.__interactions.values()].map((e) => e.duration)");
  inps.push(all.length ? Math.max(...all) : 0); // under 50 interactions, INP is the worst one
}

console.log(`${url} — ${throttle} throttling, median of ${runs} runs`);
for (const [label, values] of Object.entries(perStep)) console.log(`  ${label.padEnd(16)} ${ms(median(values))}`);
console.log(`  INP              ${ms(median(inps))}  (good ≤ 200 ms)`);
