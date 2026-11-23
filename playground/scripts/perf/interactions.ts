// Each scripted interaction in perf.config.ts (`steps`), as the user sees
// it: its latency (Event Timing, the basis of INP), how long a loading
// indicator (`loaders`) stayed visible after it, and the layout it shifted.
// CLS ignores shifts within 500 ms of input; this counts them, since content
// that jumps after a click is still a jump.
// Bun.WebView's input is native (isTrusted), so the browser times it as it
// would a person's. `--early` starts right at the ready mark instead of once
// the page settles. INP doesn't count waiting for a lazy chunk, so an early
// click can score better while showing a spinner: the loader column shows it.
// Usage: bun run perf:interactions -- [url] [--runs 3] [--throttle mobile|desktop|none] [--early]
import { config, need, READY } from "./_config";
import { afterInteraction, median, ms, openView, parseArgs, settle, waitFor } from "./_shared";

const { url, runs, throttle, flags } = parseArgs(undefined, { runs: 3 });
const early = flags.has("early");
const steps = need(config.steps, "steps", "perf:interactions");
const loaders = config.loaders ?? [];

const observe = `
  // Latency per interaction: the longest event entry sharing its interactionId.
  window.__interactions = new Map();
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.interactionId) continue;
      const prev = window.__interactions.get(e.interactionId);
      if (!prev || e.duration > prev.duration) window.__interactions.set(e.interactionId, { start: e.startTime, duration: e.duration });
    }
  }).observe({ type: "event", durationThreshold: 16, buffered: true });
  // Every layout shift, input-driven ones included, with the element that moved most.
  window.__shifts = [];
  // The nearest element with an id or class: a moved text node names its line's container.
  const label = (n) => {
    let el = n?.nodeType === 1 ? n : n?.parentElement;
    for (let up = 0; el && !el.id && !el.classList.length && up < 4; up++) el = el.parentElement;
    return !el ? "?" : el.localName + (el.id ? "#" + el.id : "." + el.classList[0]) + (n.nodeType === 3 ? " (text)" : "");
  };
  const area = (s) => s.previousRect.width * s.previousRect.height;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const moved = [...e.sources].sort((a, b) => area(b) - area(a))[0];
      // A node removed since has no element: describe its box instead.
      const where = moved?.node ? label(moved.node) : moved
        ? "(removed) " + Math.round(moved.previousRect.width) + "x" + Math.round(moved.previousRect.height) + " at y " + Math.round(moved.previousRect.y) + " → " + Math.round(moved.currentRect.y)
        : "?";
      window.__shifts.push([e.startTime, e.value, where]);
    }
  }).observe({ type: "layout-shift", buffered: true });
  // When any loader is on screen, as [from, to] spans.
  window.__loaders = { spans: [], since: null };
  const selectors = ${JSON.stringify(loaders)};
  if (selectors.length) {
    const l = window.__loaders;
    const shown = () => selectors.some((s) => [...document.querySelectorAll(s)].some((el) => el.getClientRects().length > 0));
    new MutationObserver(() => {
      const on = shown();
      if (on && l.since === null) l.since = performance.now();
      else if (!on && l.since !== null) { l.spans.push([l.since, performance.now()]); l.since = null; }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-busy"] });
  }
`;

type Result = {
  entries: { start: number; duration: number }[];
  shifts: [number, number, string][];
  spans: [number, number][];
  now: number;
};

const latency: Record<string, number[]> = {};
const loaderTime: Record<string, number[]> = {};
const shifted: Record<string, number[]> = {};
const movers: Record<string, Map<string, number>> = {};
const inps: number[] = [];
const beforeFirst: number[] = [];
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
  const r = await view.evaluate<Result>(`(() => {
    const l = window.__loaders;
    const now = performance.now();
    return {
      entries: [...window.__interactions.values()],
      shifts: window.__shifts,
      spans: l.since === null ? l.spans : [...l.spans, [l.since, now]],
      now,
    };
  })()`);
  const overlap = (from: number, to: number) =>
    r.spans.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0);
  for (const [index, step] of steps.entries()) {
    const from = starts[index] ?? 0;
    const to = starts[index + 1] ?? r.now;
    const durations = r.entries.filter((e) => e.start >= from && e.start < to).map((e) => e.duration);
    (latency[step.label] ??= []).push(durations.length ? Math.max(...durations) : 0);
    (loaderTime[step.label] ??= []).push(overlap(from, to));
    const inStep = r.shifts.filter(([t]) => t >= from && t < to);
    (shifted[step.label] ??= []).push(inStep.reduce((sum, [, v]) => sum + v, 0));
    const moved = (movers[step.label] ??= new Map());
    for (const [, value, node] of inStep) moved.set(node, (moved.get(node) ?? 0) + value / runs);
  }
  beforeFirst.push(overlap(0, starts[0] ?? r.now));
  // Under 50 interactions, INP is the worst one.
  inps.push(r.entries.length ? Math.max(...r.entries.map((e) => e.duration)) : 0);
}

console.log(`${url} — ${throttle} throttling${early ? ", from the ready mark" : ""}, median of ${runs} runs\n`);
console.log(
  `  ${"step".padEnd(18)}${"latency".padStart(9)}${loaders.length ? "loader".padStart(9) : ""}${"shift".padStart(8)}`,
);
for (const step of steps) {
  const loader = loaders.length ? ms(median(loaderTime[step.label] ?? [0])).padStart(9) : "";
  console.log(
    `  ${step.label.padEnd(18)}${ms(median(latency[step.label] ?? [0])).padStart(9)}${loader}${median(
      shifted[step.label] ?? [0],
    )
      .toFixed(3)
      .padStart(8)}`,
  );
}
for (const step of steps) {
  const [top] = [...(movers[step.label] ?? [])].sort((a, b) => b[1] - a[1]);
  if (top && top[1] >= 0.01) console.log(`  ${step.label}: ${top[0]} moved most (${top[1].toFixed(3)})`);
}
console.log(`\n  INP               ${ms(median(inps))}  (good ≤ 200 ms)`);
if (loaders.length) console.log(`  loader before the first step: ${ms(median(beforeFirst))}`);
