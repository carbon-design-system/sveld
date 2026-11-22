// What the user sees during one action: every distinct frame Chrome paints
// after it, with its time, and the CSS animations and transitions that ran.
// An instant change paints one new frame and runs no animation; a fade or a
// loading flash shows up as several frames.
// Actions come from perf.config.ts (`actions`); the first is the default.
// Usage: bun run perf:frames -- [url] [--action name] [--out dir]
//   [--throttle none|desktop|mobile] [--early]
// --out writes each distinct frame as a JPEG, to look at what changed.
// --early acts right at the ready mark, before idle-time loading finishes,
// the worst case for anything loaded lazily.
import { mkdirSync } from "node:fs";
import { config, need, READY } from "./_config";
import { openView, parseArgs, waitFor } from "./_shared";
import { cdpData } from "./_vitals";

const argv = process.argv.slice(2);
const option = (name: string) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv.splice(at, 2)[1];
};
const actionName = option("action") ?? Object.keys(config.actions ?? {})[0] ?? "";
const out = option("out");
const { url, throttle, flags } = parseArgs(argv, { throttle: "none" });
const early = flags.has("early");
const WATCH = 1500;

const actions = need(config.actions, "actions", "perf:frames");
const action = actions[actionName];
if (!action) throw new Error(`--action must be one of ${Object.keys(actions).join(", ")}`);

// Records every animation that starts in the watch window, with its target.
const watch = `(() => {
  const seen = new Set(), found = [];
  const label = (el) => !el ? "?" : el.localName + (el.id ? "#" + el.id : el.classList[0] ? "." + el.classList[0] : "");
  const end = performance.now() + ${WATCH};
  (function poll() {
    for (const a of document.getAnimations()) {
      if (seen.has(a)) continue;
      seen.add(a);
      const timing = a.effect?.getComputedTiming?.() ?? {};
      found.push({
        kind: a.constructor.name,
        name: a.transitionProperty ?? a.animationName ?? a.id ?? "",
        target: label(a.effect?.target),
        duration: Number(timing.duration) || 0,
        delay: Number(timing.delay) || 0,
        // Epoch milliseconds, like the screencast's frame times.
        start: performance.timeOrigin + (a.startTime ?? performance.now()),
      });
    }
    if (performance.now() < end) requestAnimationFrame(poll);
  })();
  window.__animations = found;
})()`;

type Frame = { data: string; metadata: { timestamp: number }; sessionId: number };

await using view = await openView(throttle);
await view.navigate(url);
await waitFor(view, READY);
if (!early) await Bun.sleep(2000);
if (action.setup) {
  await action.setup(view);
  await Bun.sleep(500);
}

const frames: { time: number; data: string }[] = [];
// Each frame must be acknowledged before Chrome sends the next. `cdp()` takes
// one call at a time, so the acknowledgements queue.
let acks = Promise.resolve();
view.addEventListener("Page.screencastFrame", (event) => {
  const frame = cdpData<Frame>(event);
  frames.push({ time: frame.metadata.timestamp * 1000, data: frame.data });
  acks = acks.then(() => view.cdp("Page.screencastFrameAck", { sessionId: frame.sessionId }).then(() => undefined));
});
await view.cdp("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1 });
await Bun.sleep(early ? 50 : 300); // the first frame is the current page
await view.evaluate(watch);
const start = Date.now();
await action.run(view);
await Bun.sleep(WATCH);
await acks;
await view.cdp("Page.stopScreencast");
type Animation = { kind: string; name: string; target: string; duration: number; delay: number; start: number };
const animations: Animation[] = await view.evaluate("window.__animations");
// One frame of slack: a frame shows the state just before its swap time.
const running = (time: number) =>
  animations.filter((a) => time >= a.start && time <= a.start + a.delay + a.duration + 17);

// A frame identical to the one before it is not a visible change.
const distinct = frames.filter((frame, i) => i === 0 || frame.data !== frames[i - 1]?.data);
const before = distinct.filter((f) => f.time < start);
const after = distinct.filter((f) => f.time >= start);
if (out) mkdirSync(out, { recursive: true });

console.log(
  `${url} — ${actionName}${early ? " at the ready mark" : ""}, ${throttle} throttling, ${WATCH} ms after the action\n`,
);
console.log(`  frames       ${after.length} distinct after the action (${frames.length} received)`);
for (const [i, f] of after.entries()) {
  const path = out ? `${out}/${actionName}-${String(i).padStart(2, "0")}.jpg` : "";
  if (path) await Bun.write(path, Buffer.from(f.data, "base64"));
  const during = [...new Set(running(f.time).map((a) => `${a.name || a.kind} on ${a.target}`))].join(", ");
  console.log(
    `    +${String(Math.round(f.time - start)).padStart(4)} ms  ${during ? `during ${during}` : "no animation"}  ${path}`,
  );
}
if (before.length && out)
  await Bun.write(`${out}/${actionName}-before.jpg`, Buffer.from(before.at(-1)?.data ?? "", "base64"));
console.log(`  animations   ${animations.length}`);
for (const a of animations.slice(0, 20)) {
  console.log(
    `    ${a.kind} ${a.name || "(unnamed)"} on ${a.target}, ${a.duration} ms${a.delay ? ` after ${a.delay} ms` : ""}`,
  );
}
if (animations.length > 20) console.log(`    ... ${animations.length - 20} more`);
