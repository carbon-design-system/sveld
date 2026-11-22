// When the content that matters appears, relative to first paint: the
// `element` in perf.config.ts, such as a code editor's highlighted tokens.
// A gap means the page paints before that content is ready.
// Usage: bun run perf:first-paint -- [url] [--runs 5] [--throttle mobile|desktop|none]
import { config, need } from "./_config";
import { median, ms, openView, parseArgs, waitFor } from "./_shared";

const { url, runs, throttle } = parseArgs();
const element = need(config.element, "element", "perf:first-paint");

// Injected before any of the page's own scripts run.
const observe = `
  window.__m = {};
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (e.name === "first-contentful-paint") window.__m.fcp = e.startTime;
  }).observe({ type: "paint", buffered: true });
  new MutationObserver(() => {
    if (!window.__m.colored && document.querySelector(${JSON.stringify(element.selector)}))
      window.__m.colored = performance.now();
  }).observe(document, { subtree: true, childList: true });
`;

const results: { fcp: number; colored: number }[] = [];
for (let i = 0; i < runs; i++) {
  await using view = await openView(throttle, { initScript: observe });
  await view.navigate(url);
  await waitFor(view, "window.__m.fcp !== undefined && window.__m.colored !== undefined");
  results.push(await view.evaluate("window.__m"));
}

const gap = median(results.map((r) => Math.max(0, r.colored - r.fcp)));
console.log(
  `FCP ${ms(median(results.map((r) => r.fcp)))}, ${element.label} ${ms(median(results.map((r) => r.colored)))}, ` +
    `${ms(gap)} after first paint (${throttle}, median of ${runs})`,
);
