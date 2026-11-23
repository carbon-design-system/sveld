// Prefetch on intent: does pointing at something give the lazy chunk it
// needs enough of a head start? For each `intent` in perf.config.ts, from
// the ready mark (the worst case; `--late` waits for the page to settle
// first), moves the pointer onto `hover`, pauses as a person would, then
// runs `steps`. Reports whether `chunk` was ready when the last step ran,
// still loading, or not requested yet, and how long the user then waited.
// A pause of 0 is pointing and acting at once: no head start.
// Usage: bun run perf:intent -- [url] [--pause 0,300,1000] [--runs 3]
//   [--throttle mobile|desktop|none] [--late]
import { config, need, READY } from "./_config";
import { median, ms, nextFrame, openView, parseArgs, settle, waitFor } from "./_shared";

const argv = process.argv.slice(2);
const at = argv.indexOf("--pause");
const pauses = (at === -1 ? "0,300,1000" : (argv.splice(at, 2)[1] ?? "")).split(",").map(Number);
const { url, runs, throttle, flags } = parseArgs(argv, { runs: 3 });
const late = flags.has("late");
const intents = need(config.intent, "intent", "perf:intent");

type Timing = { start: number; end: number } | null;
type Outcome = { state: "ready" | "loading" | "not requested"; wait: number };

async function measure(intent: (typeof intents)[number], pause: number): Promise<Outcome> {
  await using view = await openView(throttle);
  await view.navigate(url);
  await waitFor(view, READY);
  if (late) await settle(view);
  const point = await view.evaluate<{ x: number; y: number } | null>(`(() => {
    const el = document.querySelector(${JSON.stringify(intent.hover)});
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!point) throw new Error(`no element matches ${intent.hover}`);
  // Bun.WebView has no hover; CDP's mouse events are trusted input too.
  await view.cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await Bun.sleep(pause);
  let needAt = 0;
  for (const [index, step] of intent.steps.entries()) {
    if (index === intent.steps.length - 1) needAt = await view.evaluate<number>("performance.now()");
    await step(view);
    // Only the next frame: a person doesn't wait for the network between clicks.
    await nextFrame(view);
  }
  const chunk = `performance.getEntriesByType("resource").find((r) => ${intent.chunk}.test(r.name))`;
  await waitFor(view, `${chunk}?.responseEnd > 0`);
  const timing = await view.evaluate<Timing>(
    `(() => { const r = ${chunk}; return r ? { start: r.startTime, end: r.responseEnd } : null; })()`,
  );
  if (!timing) throw new Error(`no request matched ${intent.chunk}`);
  if (timing.end <= needAt) return { state: "ready", wait: 0 };
  return { state: timing.start <= needAt ? "loading" : "not requested", wait: timing.end - needAt };
}

console.log(
  `${url} — ${throttle} throttling, from ${late ? "a settled page" : "the ready mark"}, median of ${runs} runs\n`,
);
for (const intent of intents) {
  console.log(`  ${intent.label}`);
  console.log(`  ${"pause".padStart(8)}  ${"chunk when needed".padEnd(26)}user waits`);
  for (const pause of pauses) {
    const outcomes: Outcome[] = [];
    for (let i = 0; i < runs; i++) outcomes.push(await measure(intent, pause));
    const states = [...new Set(outcomes.map((o) => o.state))].join(" / ");
    console.log(`  ${ms(pause).padStart(8)}  ${states.padEnd(26)}${ms(median(outcomes.map((o) => o.wait)))}`);
  }
}
