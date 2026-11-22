// Shared setup for the Bun.WebView perf scripts: a headless Chrome tab with
// Lighthouse-style throttling applied over CDP.

/** Lighthouse's presets: mobile is "slow 4G" with a 4x slower CPU. */
export const THROTTLE = {
  mobile: { latency: 150, down: 1.6e6, up: 750e3, cpu: 4 },
  desktop: { latency: 40, down: 10e6, up: 10e6, cpu: 1 },
  none: undefined,
} as const;

export type Throttle = keyof typeof THROTTLE;

export type Args = { url: string; runs: number; throttle: Throttle };

/** `[url] [--runs N] [--throttle mobile|desktop|none]` */
export function parseArgs(argv = process.argv.slice(2), defaults: Partial<Args> = {}): Args {
  const args: Args = { url: "https://sveld.onrender.com/", runs: 5, throttle: "mobile", ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--runs") args.runs = Number(argv[++i]);
    else if (arg === "--throttle") args.throttle = argv[++i] as Throttle;
    else args.url = arg;
  }
  if (!(args.throttle in THROTTLE)) throw new Error(`--throttle must be one of ${Object.keys(THROTTLE).join(", ")}`);
  return args;
}

/**
 * A fresh tab in a headless Chrome Bun spawns (`url: false`: never attach to
 * the user's own browser), cache off, throttled, with `initScript` injected
 * before any of the page's scripts. Navigate it yourself.
 */
export async function openView(throttle: Throttle, initScript = "") {
  const view = new Bun.WebView({ width: 1400, height: 900, backend: { type: "chrome", url: false } });
  await view.navigate("about:blank"); // cdp() needs a first navigation
  await view.cdp("Network.enable");
  await view.cdp("Network.setCacheDisabled", { cacheDisabled: true });
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

export const ms = (value: number | undefined) => (value === undefined ? "—" : `${Math.round(value)} ms`);
