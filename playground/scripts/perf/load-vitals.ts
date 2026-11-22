// Cold-load metrics: TTFB, FCP, LCP, CLS, TBT, longest task, the page's
// `hydrated` mark (if it sets one), and bytes transferred by type.
// Usage: bun run perf:load -- [url] [--runs 5] [--throttle mobile|desktop|none]
import { median, ms, openView, parseArgs, waitFor } from "./_shared";

const { url, runs, throttle } = parseArgs();

const SCRIPT_URL = /\.js(\?|$)/;

/**
 * A CDP event's params, which `Bun.WebView` dispatches as `event.data`. Its
 * types give listeners the `MessageEvent` constructor, hence the cast.
 */
const cdpData = <T>(event: unknown) => (event as MessageEvent<T>).data;

// Collects the raw entries; summarized after the page settles.
const observe = `
  window.__vitals = { lcp: 0, shifts: [], tasks: [] };
  const v = window.__vitals;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") v.fcp = e.startTime; })
    .observe({ type: "paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) v.lcp = e.startTime; })
    .observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) v.shifts.push([e.startTime, e.value]); })
    .observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) v.tasks.push([e.startTime, e.duration]); })
    .observe({ type: "longtask", buffered: true });
`;

const summarize = `(() => {
  const v = window.__vitals;
  const nav = performance.getEntriesByType("navigation")[0];
  // CLS: the largest session window (shifts under 1 s apart, at most 5 s long).
  let cls = 0, session = 0, first = 0, last = -Infinity;
  for (const [t, value] of v.shifts) {
    if (t - last > 1000 || t - first > 5000) { session = 0; first = t; }
    session += value; last = t; cls = Math.max(cls, session);
  }
  // TBT: each long task's time over 50 ms, from first paint on.
  const after = v.tasks.filter(([t]) => t >= v.fcp);
  return {
    ttfb: nav ? nav.responseStart : undefined,
    fcp: v.fcp,
    lcp: v.lcp,
    cls,
    tbt: after.reduce((sum, [, d]) => sum + Math.max(0, d - 50), 0),
    longestTask: Math.max(0, ...v.tasks.map(([, d]) => d)),
    hydrated: performance.getEntriesByName("hydrated")[0]?.startTime,
    load: nav ? nav.loadEventEnd : undefined,
  };
})()`;

type Vitals = Record<string, number | undefined>;
const all: Vitals[] = [];
const bytesByType: Record<string, number[]> = {};

for (let i = 0; i < runs; i++) {
  await using view = await openView(throttle, observe);
  const types = new Map<string, string>();
  const bytes: Record<string, number> = {};
  view.addEventListener("Network.responseReceived", (event) => {
    const data = cdpData<{ requestId: string; type: string; response: { url: string } }>(event);
    // A `<link rel="prefetch">` (idle-time loading) is typed "Other".
    const prefetched = data.type === "Other" && SCRIPT_URL.test(data.response.url);
    types.set(data.requestId, prefetched ? "Script (prefetched)" : data.type);
  });
  view.addEventListener("Network.loadingFinished", (event) => {
    const data = cdpData<{ requestId: string; encodedDataLength: number }>(event);
    const type = types.get(data.requestId) ?? "Other";
    bytes[type] = (bytes[type] ?? 0) + data.encodedDataLength;
  });
  await view.navigate(url);
  await waitFor(view, "window.__vitals?.fcp !== undefined");
  // Let late work (hydration, idle-time imports) finish before reading.
  await Bun.sleep(3000);
  all.push(await view.evaluate(summarize));
  for (const [type, n] of Object.entries(bytes)) (bytesByType[type] ??= []).push(n);
}

const pick = (key: string) => {
  const values = all.map((v) => v[key]).filter((v): v is number => v !== undefined);
  return values.length ? median(values) : undefined;
};
console.log(`${url} — ${throttle} throttling, median of ${runs} cold loads`);
console.log(`  TTFB          ${ms(pick("ttfb"))}`);
console.log(`  FCP           ${ms(pick("fcp"))}`);
console.log(`  LCP           ${ms(pick("lcp"))}`);
console.log(`  CLS           ${(pick("cls") ?? 0).toFixed(3)}`);
console.log(`  TBT           ${ms(pick("tbt"))}`);
console.log(`  Longest task  ${ms(pick("longestTask"))}`);
console.log(`  Hydrated      ${ms(pick("hydrated"))}`);
console.log(`  Load          ${ms(pick("load"))}`);
console.log(
  "  Transferred   " +
    Object.entries(bytesByType)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, n]) => `${type} ${(median(n) / 1000).toFixed(1)} kB`)
      .join(", "),
);
