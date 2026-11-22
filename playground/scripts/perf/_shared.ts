// Shared setup for the Bun.WebView perf scripts: a headless Chrome tab with
// Lighthouse-style throttling applied over CDP.

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
    url: "https://sveld.onrender.com/",
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

/** Polls `expression` in the page until it's truthy. */
export async function waitFor(view: Bun.WebView, expression: string, timeout = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await view.evaluate(expression)) return;
    await Bun.sleep(50);
  }
  throw new Error(`timed out waiting for ${expression}`);
}

export const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] as number;

/** Median absolute deviation: the run-to-run noise around the median. */
export const mad = (values: number[]) => {
  const mid = median(values);
  return median(values.map((v) => Math.abs(v - mid)));
};

export const ms = (value: number | undefined) => (value === undefined ? "—" : `${Math.round(value)} ms`);
