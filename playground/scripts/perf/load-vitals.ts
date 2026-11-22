// Cold-load metrics: TTFB, FCP, LCP, CLS, TBT, longest task, the page's
// `hydrated` mark (if it sets one), and bytes transferred by type.
// Usage: bun run perf:load -- [url] [--runs 5] [--throttle mobile|desktop|none]
import { median, ms, parseArgs } from "./_shared";
import { METRICS, measureLoad, type Vitals } from "./_vitals";

const { url, runs, throttle } = parseArgs();

const all: Vitals[] = [];
const bytesByType: Record<string, number[]> = {};
for (let i = 0; i < runs; i++) {
  const { vitals, bytes } = await measureLoad(url, throttle);
  all.push(vitals);
  for (const [type, n] of Object.entries(bytes)) (bytesByType[type] ??= []).push(n);
}

console.log(`${url} — ${throttle} throttling, median of ${runs} cold loads`);
for (const [key, label] of Object.entries(METRICS)) {
  const values = all.map((v) => v[key as keyof Vitals]).filter((v) => v !== undefined);
  const value = values.length ? median(values) : undefined;
  console.log(`  ${label.padEnd(14)}${key === "cls" ? (value ?? 0).toFixed(3) : ms(value)}`);
}
console.log(
  "  Transferred   " +
    Object.entries(bytesByType)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, n]) => `${type} ${(median(n) / 1000).toFixed(1)} kB`)
      .join(", "),
);
