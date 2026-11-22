// A/B cold-load comparison of two builds or URLs. Loads alternate (A B, B A,
// A B, ...) so drift in the machine or network hits both sides equally.
// Usage: bun run perf:compare -- <distA|urlA> <distB|urlB> [--runs 7] [--throttle mobile]
//   [--repeat] [--immutable]
// A dist directory is served on a fresh port, so a stale server left on a
// fixed port can never answer for it. `--repeat` compares second visits with
// a warm cache. `--immutable` serves B's hashed assets with a year-long
// immutable cache, so `dist dist --repeat --immutable` measures that header.
import { ASSETS } from "./_config";
import { mad, median, ms, parseArgs } from "./_shared";
import { LABEL_WIDTH, METRICS, measureLoad, type Requests, type Vitals } from "./_vitals";
import { serveDist } from "./serve";

const { positional, runs, throttle, flags } = parseArgs(undefined, { runs: 7 });
const repeat = flags.has("repeat");
if (positional.length !== 2) throw new Error("usage: bun compare.ts <distA|urlA> <distB|urlB> [--runs 7]");

const HTTP = /^https?:/;
const servers: ReturnType<typeof serveDist>[] = [];
const sides = positional.map((target, index) => {
  if (HTTP.test(target)) return { target, url: target };
  const immutable = index === 1 && flags.has("immutable");
  const server = serveDist(target, 0, { immutable });
  servers.push(server);
  return { target: immutable ? `${target} (${ASSETS.path}* immutable)` : target, url: server.url.href };
});

// One unrecorded load of each side first, so neither pays for a cold Chrome.
for (const side of sides) await measureLoad(side.url, throttle, { repeat });

const results = sides.map(() => ({ vitals: [] as Vitals[], bytes: [] as number[], requests: [] as Requests[] }));
for (let i = 0; i < runs; i++) {
  // A B, B A, A B, ...: going second can be systematically faster or slower.
  for (const s of i % 2 ? [1, 0] : [0, 1]) {
    const { vitals, bytes, requests } = await measureLoad((sides[s] as (typeof sides)[0]).url, throttle, { repeat });
    results[s]?.vitals.push(vitals);
    results[s]?.requests.push(requests);
    results[s]?.bytes.push(Object.values(bytes).reduce((a, b) => a + b, 0));
  }
}
for (const server of servers) server.stop();

const [a, b] = results as [(typeof results)[0], (typeof results)[0]];
const cell = (value: number, cls: boolean) => (cls ? value.toFixed(3) : ms(value)).padStart(9);
const signed = (value: number, cls: boolean) => (value > 0 ? "+" : "") + (cls ? value.toFixed(3) : ms(value));

console.log(`A  ${sides[0]?.target}\nB  ${sides[1]?.target}`);
console.log(`${throttle} throttling, median of ${runs} alternating ${repeat ? "repeat visits" : "cold loads"} each\n`);
console.log(`  ${"".padEnd(LABEL_WIDTH)}${"A".padStart(9)}${"B".padStart(9)}  ${"B − A".padEnd(18)}noise`);
for (const [key, label] of Object.entries(METRICS)) {
  const cls = key === "cls";
  const values = (side: typeof a) => side.vitals.map((v) => v[key as keyof Vitals]).filter((v) => v !== undefined);
  const [va, vb] = [values(a), values(b)];
  if (!va.length || !vb.length) continue;
  const [ma, mb] = [median(va), median(vb)];
  const delta = mb - ma;
  const noise = Math.max(mad(va), mad(vb));
  const pct = ma ? ` (${delta > 0 ? "+" : ""}${Math.round((delta / ma) * 100)}%)` : "";
  // A difference inside twice the run-to-run spread, or under 2%, is noise.
  const mark = Math.abs(delta) <= Math.max(2 * noise, 0.02 * Math.abs(ma)) ? "~" : " ";
  console.log(
    `  ${label.padEnd(LABEL_WIDTH)}${cell(ma, cls)}${cell(mb, cls)}  ${mark}${(signed(delta, cls) + pct).padEnd(17)}±${cls ? noise.toFixed(3) : ms(noise)}`,
  );
}
const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;
console.log(
  `  ${"Transferred".padEnd(LABEL_WIDTH)}${kb(median(a.bytes)).padStart(9)}${kb(median(b.bytes)).padStart(9)}`,
);
const asked = (side: typeof a) => {
  const count = (key: keyof Requests) => median(side.requests.map((r) => r[key]));
  return `${count("network")}/${count("revalidated")}/${count("cache")}`;
};
console.log(`  ${"Requests".padEnd(LABEL_WIDTH)}${asked(a).padStart(9)}${asked(b).padStart(9)}  downloaded/304/cached`);
console.log("\n~ under 2% or within twice the run-to-run noise (median absolute deviation)");
