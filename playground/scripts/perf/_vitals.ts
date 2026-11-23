// One cold load's vitals and bytes, shared by load-vitals.ts and compare.ts.
import { config, READY_TIME } from "./_config";
import { cdpData, openView, settle, type Throttle, waitFor } from "./_shared";

const SCRIPT_URL = /\.js(\?|$)/;

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
  ${
    // When the element set in perf.config.ts first appears.
    config.element
      ? `new MutationObserver((_, o) => {
          if (document.querySelector(${JSON.stringify(config.element.selector)})) { v.element = performance.now(); o.disconnect(); }
        }).observe(document, { subtree: true, childList: true });`
      : ""
  }
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
    ready: ${READY_TIME},
    element: v.element,
    load: nav ? nav.loadEventEnd : undefined,
  };
})()`;

/** Reported metrics, in order; `cls` is unitless, the rest milliseconds. */
export const METRICS = {
  ttfb: "TTFB",
  fcp: "FCP",
  lcp: "LCP",
  cls: "CLS",
  tbt: "TBT",
  longestTask: "Longest task",
  // The mark's name, capitalized: `hydrated` reads "Hydrated".
  ready: config.readyMark ? config.readyMark[0]?.toUpperCase() + config.readyMark.slice(1) : "Ready (load)",
  load: "Load",
  ...(config.element ? { element: config.element.label[0]?.toUpperCase() + config.element.label.slice(1) } : {}),
};

/** Width of the label column in reports. */
export const LABEL_WIDTH = Math.max(14, ...Object.values(METRICS).map((label) => label.length + 2));

export type Vitals = Partial<Record<keyof typeof METRICS, number>>;

/** How a repeat visit's requests were answered. */
export type Requests = { cache: number; revalidated: number; network: number };

type Response = {
  requestId: string;
  type: string;
  response: { url: string; status: number; fromDiskCache?: boolean };
};

/**
 * Loads `url` in a fresh tab and returns its vitals, bytes by type and how
 * its requests were answered. Cold by default; with `repeat`, the tab loads
 * the page once with the cache on, then measures a second visit.
 */
export async function measureLoad(url: string, throttle: Throttle, { repeat = false } = {}) {
  await using view = await openView(throttle, { initScript: observe, cache: repeat });
  let measuring = !repeat;
  const types = new Map<string, string>();
  const bytes: Record<string, number> = {};
  const requests: Requests = { cache: 0, revalidated: 0, network: 0 };
  const servedFromCache = new Set<string>();
  view.addEventListener("Network.requestServedFromCache", (event) => {
    servedFromCache.add(cdpData<{ requestId: string }>(event).requestId);
  });
  view.addEventListener("Network.responseReceived", (event) => {
    if (!measuring) return;
    const data = cdpData<Response>(event);
    if (data.response.url.startsWith("data:")) return;
    // A `<link rel="prefetch">` (idle-time loading) is typed "Other".
    const prefetched = data.type === "Other" && SCRIPT_URL.test(data.response.url);
    types.set(data.requestId, prefetched ? "Script (prefetched)" : data.type);
    if (servedFromCache.has(data.requestId) || data.response.fromDiskCache) requests.cache++;
    else if (data.response.status === 304) requests.revalidated++;
    else requests.network++;
  });
  view.addEventListener("Network.loadingFinished", (event) => {
    const data = cdpData<{ requestId: string; encodedDataLength: number }>(event);
    const type = types.get(data.requestId);
    if (type) bytes[type] = (bytes[type] ?? 0) + data.encodedDataLength;
  });
  if (repeat) {
    await view.navigate(url);
    await waitFor(view, `document.readyState === "complete"`);
    // Idle-time prefetches fill the cache too.
    await settle(view);
    measuring = true;
  }
  await view.navigate(url);
  await waitFor(view, "window.__vitals?.fcp !== undefined");
  // Let late work (hydration, idle-time imports and prefetches) finish.
  await settle(view);
  const vitals: Vitals = await view.evaluate(summarize);
  return { vitals, bytes, requests };
}
