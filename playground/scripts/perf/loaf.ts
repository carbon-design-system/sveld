// Why frames are slow: every long animation frame (over 50 ms) during load
// and the playground's scripted interactions, with the scripts that ran in it
// (what invoked them, where they came from) and the time spent in style and
// layout. `interactions.ts` says how slow an interaction is; this says why.
// Usage: bun run perf:loaf -- [url] [--throttle mobile|desktop|none] [--runs 3]
// Function names are only readable in an unminified build (see profile.ts).
import { config, need, READY } from "./_config";
import { afterInteraction, ms, openView, parseArgs, settle, shortUrl, waitFor } from "./_shared";

const { url, throttle, runs } = parseArgs(undefined, { runs: 3 });
const steps = need(config.steps, "steps", "perf:loaf");

const observe = `
  window.__loaf = [];
  new PerformanceObserver((list) => {
    for (const f of list.getEntries()) {
      window.__loaf.push({
        start: f.startTime,
        duration: f.duration,
        blocking: f.blockingDuration,
        // Rendering: from the frame's render start to its end.
        render: f.renderStart ? f.startTime + f.duration - f.renderStart : 0,
        styleLayout: f.styleAndLayoutStart ? f.startTime + f.duration - f.styleAndLayoutStart : 0,
        scripts: f.scripts.map((s) => ({
          invoker: s.invoker,
          type: s.invokerType,
          source: s.sourceURL,
          fn: s.sourceFunctionName,
          duration: s.duration,
          forced: s.forcedStyleAndLayoutDuration,
        })),
      });
    }
  }).observe({ type: "long-animation-frame", buffered: true });
`;

type Script = { invoker: string; type: string; source: string; fn: string; duration: number; forced: number };
type Loaf = {
  start: number;
  duration: number;
  blocking: number;
  render: number;
  styleLayout: number;
  scripts: Script[];
};

/** Per phase (load or a step): its frames, across runs. */
const byPhase = new Map<string, Loaf[]>();
for (let i = 0; i < runs; i++) {
  await using view = await openView(throttle, { initScript: observe });
  await view.navigate(url);
  await waitFor(view, READY);
  await settle(view);
  const marks: { label: string; at: number }[] = [{ label: "load", at: 0 }];
  for (const step of steps) {
    marks.push({ label: step.label, at: await view.evaluate<number>("performance.now()") });
    await step.run(view);
    await afterInteraction(view);
  }
  const frames = await view.evaluate<Loaf[]>("window.__loaf");
  for (const frame of frames) {
    const phase = marks.findLast((m) => m.at <= frame.start)?.label ?? "load";
    (byPhase.get(phase) ?? byPhase.set(phase, []).get(phase))?.push(frame);
  }
}

const where = (s: Script) => `${s.fn || "(anonymous)"}  ${s.source ? shortUrl(s.source) : ""}`.trim();

console.log(`${url} — ${throttle} throttling, ${runs} runs, frames over 50 ms (per-run averages)\n`);
console.log(
  `  ${"phase".padEnd(16)}${"frames".padStart(7)}${"longest".padStart(10)}${"blocking".padStart(10)}${"style+layout".padStart(14)}`,
);
for (const [phase, frames] of byPhase) {
  const longest = Math.max(...frames.map((f) => f.duration));
  const blocking = frames.reduce((s, f) => s + f.blocking, 0) / runs;
  const layout = frames.reduce((s, f) => s + f.styleLayout, 0) / runs;
  console.log(
    `  ${phase.padEnd(16)}${(frames.length / runs).toFixed(1).padStart(7)}${ms(longest).padStart(10)}${ms(blocking).padStart(10)}${ms(layout).padStart(14)}`,
  );
}

console.log("\n  scripts in those frames, by total time (per-run average)");
const totals = new Map<string, { duration: number; forced: number; count: number; invokers: Set<string> }>();
for (const [phase, frames] of byPhase) {
  for (const s of frames.flatMap((f) => f.scripts)) {
    const key = `${phase}|${where(s)}`;
    const t = totals.get(key) ?? { duration: 0, forced: 0, count: 0, invokers: new Set() };
    t.duration += s.duration;
    t.forced += s.forced;
    t.count++;
    t.invokers.add(`${s.type}: ${s.invoker}`);
    totals.set(key, t);
  }
}
for (const [key, t] of [...totals].sort((a, b) => b[1].duration - a[1].duration).slice(0, 15)) {
  const [phase, fn] = key.split("|");
  const forced = t.forced > 1 ? `, ${ms(t.forced / runs)} forced layout` : "";
  console.log(`  ${ms(t.duration / runs).padStart(8)}  ${phase?.padEnd(16)}${fn}${forced}`);
  console.log(`  ${"".padStart(8)}  ${"".padEnd(16)}via ${[...t.invokers].slice(0, 2).join("; ")}`);
}
