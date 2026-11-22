// A/B cold-load comparison of two builds or URLs. Loads alternate (A B, B A,
// A B, ...) so drift in the machine or network hits both sides equally.
// Usage: bun run perf:compare -- <distA|urlA> <distB|urlB> [--runs 7] [--throttle mobile]
// A dist directory is served on a fresh port, so a stale server left on a
// fixed port can never answer for it.
import { mad, median, ms, parseArgs } from "./_shared";
import { METRICS, measureLoad, type Vitals } from "./_vitals";
import { serveDist } from "./serve";

const { positional, runs, throttle } = parseArgs(undefined, { runs: 7 });
if (positional.length !== 2) throw new Error("usage: bun compare.ts <distA|urlA> <distB|urlB> [--runs 7]");

const HTTP = /^https?:/;
const servers: ReturnType<typeof serveDist>[] = [];
const sides = positional.map((target) => {
  if (HTTP.test(target)) return { target, url: target };
  const server = serveDist(target, 0);
  servers.push(server);
  return { target, url: server.url.href };
});

// One unrecorded load of each side first, so neither pays for a cold Chrome.
for (const side of sides) await measureLoad(side.url, throttle);

const results = sides.map(() => ({ vitals: [] as Vitals[], bytes: [] as number[] }));
for (let i = 0; i < runs; i++) {
  // A B, B A, A B, ...: going second can be systematically faster or slower.
  for (const s of i % 2 ? [1, 0] : [0, 1]) {
    const { vitals, bytes } = await measureLoad((sides[s] as (typeof sides)[0]).url, throttle);
    results[s]?.vitals.push(vitals);
    results[s]?.bytes.push(Object.values(bytes).reduce((a, b) => a + b, 0));
  }
}
for (const server of servers) server.stop();

const [a, b] = results as [(typeof results)[0], (typeof results)[0]];
const cell = (value: number, cls: boolean) => (cls ? value.toFixed(3) : ms(value)).padStart(9);
const signed = (value: number, cls: boolean) => (value > 0 ? "+" : "") + (cls ? value.toFixed(3) : ms(value));

console.log(`A  ${sides[0]?.target}\nB  ${sides[1]?.target}`);
console.log(`${throttle} throttling, median of ${runs} alternating cold loads each\n`);
console.log(`  ${"".padEnd(14)}${"A".padStart(9)}${"B".padStart(9)}  ${"B − A".padEnd(18)}noise`);
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
    `  ${label.padEnd(14)}${cell(ma, cls)}${cell(mb, cls)}  ${mark}${(signed(delta, cls) + pct).padEnd(17)}±${cls ? noise.toFixed(3) : ms(noise)}`,
  );
}
const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;
console.log(`  ${"Transferred".padEnd(14)}${kb(median(a.bytes)).padStart(9)}${kb(median(b.bytes)).padStart(9)}`);
console.log("\n~ under 2% or within twice the run-to-run noise (median absolute deviation)");
