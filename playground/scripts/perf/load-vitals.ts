// Cold-load metrics: TTFB, FCP, LCP, CLS, TBT, longest task, the page's
// `hydrated` mark (if it sets one), and bytes transferred by type.
// `--repeat` measures a second visit with a warm cache instead of a cold one.
// Usage: bun run perf:load -- [url] [--runs 5] [--throttle mobile|desktop|none] [--repeat]
import { median, ms, parseArgs } from "./_shared";
import { METRICS, measureLoad, type Requests, type Vitals } from "./_vitals";

const { url, runs, throttle, flags } = parseArgs();
const repeat = flags.has("repeat");

const all: Vitals[] = [];
const bytesByType: Record<string, number[]> = {};
const answered: Requests[] = [];
for (let i = 0; i < runs; i++) {
  const { vitals, bytes, requests } = await measureLoad(url, throttle, { repeat });
  all.push(vitals);
  answered.push(requests);
  for (const [type, n] of Object.entries(bytes)) (bytesByType[type] ??= []).push(n);
}

console.log(`${url} — ${throttle} throttling, median of ${runs} ${repeat ? "repeat visits" : "cold loads"}`);
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
const count = (key: keyof Requests) => median(answered.map((r) => r[key]));
console.log(
  `  Requests      ${count("network")} downloaded, ${count("revalidated")} revalidated (304), ${count("cache")} from cache`,
);
