// INP from the browser's Event Timing API, over scripted playground
// interactions: tab switches, picking an example, and typing in the editor.
// Bun.WebView's input is native (isTrusted), so the browser times it as it
// would a person's. `--early` starts right at the `hydrated` mark instead of
// 2 s later, before idle-time loading finishes. INP doesn't count waiting
// for a lazy chunk, so an early click can score better while showing a
// spinner; `perf:frames --early` shows what the user sees.
// Usage: bun run perf:interactions -- [url] [--runs 3] [--throttle mobile|desktop|none] [--early]
import { HYDRATED, STEPS as steps } from "./_playground";
import { median, ms, openView, parseArgs, waitFor } from "./_shared";

const { url, runs, throttle, flags } = parseArgs(undefined, { runs: 3 });
const early = flags.has("early");

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

const perStep: Record<string, number[]> = {};
const inps: number[] = [];
for (let i = 0; i < runs; i++) {
  await using view = await openView(throttle, { initScript: observe });
  await view.navigate(url);
  // Interactive once the page marks hydration (or after load, if it doesn't).
  await waitFor(view, HYDRATED);
  if (!early) await Bun.sleep(2000); // like a person reading first; idle-time work settles
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
