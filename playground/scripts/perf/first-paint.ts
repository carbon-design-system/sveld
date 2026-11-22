// When the playground's code editor gets its colors, relative to first paint.
// Usage: bun run perf:first-paint -- [url] [--runs 5] [--throttle mobile|desktop|none]
import { median, ms, openView, parseArgs, waitFor } from "./_shared";

const { url, runs, throttle } = parseArgs();

// Injected before any of the page's own scripts run.
const observe = `
  window.__m = {};
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (e.name === "first-contentful-paint") window.__m.fcp = e.startTime;
  }).observe({ type: "paint", buffered: true });
  new MutationObserver(() => {
    if (!window.__m.colored && document.querySelector(".code-editor code span[class^=hljs-]"))
      window.__m.colored = performance.now();
  }).observe(document, { subtree: true, childList: true });
`;

const results: { fcp: number; colored: number }[] = [];
for (let i = 0; i < runs; i++) {
  await using view = await openView(throttle, observe);
  await view.navigate(url);
  await waitFor(view, "window.__m.fcp !== undefined && window.__m.colored !== undefined");
  results.push(await view.evaluate("window.__m"));
}

const gap = median(results.map((r) => Math.max(0, r.colored - r.fcp)));
console.log(
  `FCP ${ms(median(results.map((r) => r.fcp)))}, editor colored ${ms(median(results.map((r) => r.colored)))}, ` +
    `uncolored for ${ms(gap)} after first paint (${throttle}, median of ${runs})`,
);
