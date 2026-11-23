// Shared setup for the Bun.WebView perf scripts: a headless Chrome tab with
// Lighthouse-style throttling applied over CDP.
import { config } from "./_config";

/** Lighthouse's presets: mobile is "slow 4G" with a 4x slower CPU. */
export const THROTTLE = {
  mobile: { latency: 150, down: 1.6e6, up: 750e3, cpu: 4 },
  desktop: { latency: 40, down: 10e6, up: 10e6, cpu: 1 },
  none: undefined,
} as const;

export type Throttle = keyof typeof THROTTLE;

/** `positional` holds every non-flag argument; `url` is the first of them. */
export type Args = { url: string; positional: string[]; runs: number; throttle: Throttle; flags: Set<string> };

/** `[url] [--runs N] [--throttle mobile|desktop|none] [--flag]...` */
export function parseArgs(argv = process.argv.slice(2), defaults: Partial<Args> = {}): Args {
  const args: Args = {
    url: config.url ?? "",
    positional: [],
    runs: 5,
    throttle: "mobile",
    flags: new Set(),
    ...defaults,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--runs") args.runs = Number(argv[++i]);
    else if (arg === "--throttle") args.throttle = argv[++i] as Throttle;
    else if (arg.startsWith("--")) args.flags.add(arg.slice(2));
    else args.positional.push(arg);
  }
  if (args.positional[0]) args.url = args.positional[0];
  if (!args.url) throw new Error("pass a URL, or set `url` in perf.config.ts");
  if (!(args.throttle in THROTTLE)) throw new Error(`--throttle must be one of ${Object.keys(THROTTLE).join(", ")}`);
  return args;
}

export type ViewOptions = {
  /** Injected before any of the page's own scripts. */
  initScript?: string;
  /** Receives the page's `console.*` calls. */
  console?: Bun.WebView.ConsoleCapture;
  /** Keep the HTTP cache on, to measure a repeat visit. */
  cache?: boolean;
};

/**
 * A fresh tab in a headless Chrome Bun spawns (`url: false`: never attach to
 * the user's own browser), cache off unless `cache` is set, throttled.
 * Navigate it yourself.
 */
export async function openView(throttle: Throttle, { initScript, console, cache = false }: ViewOptions = {}) {
  const view = new Bun.WebView({ width: 1400, height: 900, backend: { type: "chrome", url: false }, console });
  await view.navigate("about:blank"); // cdp() needs a first navigation
  trackRequests(view);
  await view.cdp("Network.enable");
  await view.cdp("Network.setCacheDisabled", { cacheDisabled: !cache });
  const preset = THROTTLE[throttle];
  if (preset) {
    await view.cdp("Network.emulateNetworkConditions", {
      offline: false,
      latency: preset.latency,
      downloadThroughput: preset.down / 8,
      uploadThroughput: preset.up / 8,
    });
    await view.cdp("Emulation.setCPUThrottlingRate", { rate: preset.cpu });
  }
  if (initScript) await view.cdp("Page.addScriptToEvaluateOnNewDocument", { source: initScript });
  return view;
}

/**
 * A CDP event's params, which `Bun.WebView` dispatches as `event.data`. Its
 * types give listeners the `MessageEvent` constructor, hence the cast.
 */
export const cdpData = <T>(event: unknown) => (event as MessageEvent<T>).data;

/** Requests each view has in flight, and when that last changed. */
const network = new WeakMap<Bun.WebView, { pending: Set<string>; changed: number }>();

function trackRequests(view: Bun.WebView) {
  const state = { pending: new Set<string>(), changed: Date.now() };
  network.set(view, state);
  const update = (event: unknown, add: boolean) => {
    const { requestId } = cdpData<{ requestId: string }>(event);
    if (add) state.pending.add(requestId);
    else state.pending.delete(requestId);
    state.changed = Date.now();
  };
  view.addEventListener("Network.requestWillBeSent", (event) => update(event, true));
  view.addEventListener("Network.loadingFinished", (event) => update(event, false));
  view.addEventListener("Network.loadingFailed", (event) => update(event, false));
}

/**
 * Waits in the page until `expression` is truthy: one round trip, and it
 * resolves within a few ms of the condition instead of at the next poll.
 */
export async function waitFor(view: Bun.WebView, expression: string, timeout = 30_000) {
  const met = await view.evaluate<boolean>(`new Promise((resolve) => {
    const end = performance.now() + ${timeout};
    (function check() {
      let value;
      try { value = (${expression}); } catch {}
      if (value) resolve(true);
      else if (performance.now() > end) resolve(false);
      else setTimeout(check, 16);
    })();
  })`);
  if (!met) throw new Error(`timed out waiting for ${expression}`);
}

const IDLE = `new Promise((resolve) => (window.requestIdleCallback ?? setTimeout)(() => resolve(), { timeout: 1000 }))`;

/**
 * Waits until the page has settled: no request in flight for `quiet` ms,
 * then an idle callback, and again if that callback started a request (an
 * idle-time prefetch). Gives up after `timeout`, as a page that polls or
 * streams never settles.
 */
export async function settle(view: Bun.WebView, { quiet = 500, timeout = 15_000 } = {}) {
  const state = network.get(view);
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (!state || (state.pending.size === 0 && Date.now() - state.changed >= quiet)) {
      const idleFrom = Date.now();
      await view.evaluate(IDLE);
      if (!state || (state.pending.size === 0 && state.changed < idleFrom)) return;
    }
    await Bun.sleep(25);
  }
}

/** Waits for the page's next frame. */
export const nextFrame = (view: Bun.WebView) =>
  view.evaluate("new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))");

/** After an interaction: its next frame, then a short settle for what it loaded. */
export async function afterInteraction(view: Bun.WebView) {
  await nextFrame(view);
  await settle(view, { quiet: 150 });
}

const ORIGIN = /^https?:\/\/[^/]+\//;
const QUERY = /\?.*$/;

/** A URL without its origin or query, or `empty` for a page-relative "". */
export const shortUrl = (url: string, empty = "(inline)") => url.replace(ORIGIN, "").replace(QUERY, "") || empty;

export const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] as number;

/** Median absolute deviation: the run-to-run noise around the median. */
export const mad = (values: number[]) => {
  const mid = median(values);
  return median(values.map((v) => Math.abs(v - mid)));
};

export const ms = (value: number | undefined) => (value === undefined ? "—" : `${Math.round(value)} ms`);
