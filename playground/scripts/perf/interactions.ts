// INP from the browser's Event Timing API, over the scripted
// interactions in perf.config.ts (`steps`).
// Bun.WebView's input is native (isTrusted), so the browser times it as it
// would a person's. `--early` starts right at the ready mark instead of
// 2 s later, before idle-time loading finishes. INP doesn't count waiting
// for a lazy chunk, so an early click can score better while showing a
// spinner; `perf:frames --early` shows what the user sees.
// Usage: bun run perf:interactions -- [url] [--runs 3] [--throttle mobile|desktop|none] [--early]
import { config, need, READY } from "./_config";
import { afterInteraction, median, ms, openView, parseArgs, settle, waitFor } from "./_shared";

const { url, runs, throttle, flags } = parseArgs(undefined, { runs: 3 });
const early = flags.has("early");
const steps = need(config.steps, "steps", "perf:interactions");

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
  // Interactive once the page sets its ready mark (or after load).
  await waitFor(view, READY);
  if (!early) await settle(view); // like a person reading first; idle-time work settles
  // Entries can arrive after the next step starts, so each is matched to a
  // step by when its input happened, once they're all in.
  const starts: number[] = [];
  for (const step of steps) {
    starts.push(await view.evaluate<number>("performance.now()"));
    await step.run(view);
    await afterInteraction(view);
  }
  await settle(view, { quiet: 300 });
  const entries = await view.evaluate<{ start: number; duration: number }[]>("[...window.__interactions.values()]");
  for (const [index, step] of steps.entries()) {
    const from = starts[index] ?? 0;
    const to = starts[index + 1] ?? Infinity;
    const durations = entries.filter((e) => e.start >= from && e.start < to).map((e) => e.duration);
    (perStep[step.label] ??= []).push(durations.length ? Math.max(...durations) : 0);
  }
  // Under 50 interactions, INP is the worst one.
  inps.push(entries.length ? Math.max(...entries.map((e) => e.duration)) : 0);
}

console.log(`${url} — ${throttle} throttling, median of ${runs} runs`);
for (const [label, values] of Object.entries(perStep)) console.log(`  ${label.padEnd(16)} ${ms(median(values))}`);
console.log(`  INP              ${ms(median(inps))}  (good ≤ 200 ms)`);
