// The config's shape, apart from the code that loads it: perf.config.ts
// imports this, and _config.ts imports perf.config.ts, so keeping them in
// one module would make a cycle that deadlocks on the top-level await.

/** One scripted interaction; `label` names it in reports. */
export type Step = { label: string; run: (view: Bun.WebView) => Promise<unknown> };

export type PerfConfig = {
  /** The page to measure when no URL is given. */
  url?: string;
  /**
   * The `performance.mark()` the page sets once it's interactive, such as
   * right after `hydrate()`. Without one, scripts wait for `load`.
   */
  readyMark?: string;
  /** Where the build puts content-hashed files, and how their names carry the hash. */
  assets?: { path?: string; hash?: RegExp };
  /** Interactions for `interactions`, `loaf` and `coverage --interact`. */
  steps?: Step[];
  /** Named actions for `frames --action`, with optional setup run first. */
  actions?: Record<string, { setup?: Step["run"]; run: Step["run"] }>;
  /** Lazy chunks and the UI that needs them, for `timeline`. */
  lazyUI?: { ui: string; chunk: RegExp }[];
  /** For `first-paint`: an element whose arrival marks the content ready. */
  element?: { label: string; selector: string };
  /** For `coverage`: the CSS block a selector styles (group 1), such as a BEM block. */
  cssBlock?: RegExp;
  /** For `typing`: an editable element, and text of a given number of lines to fill it with. */
  typing?: { target: string; fill: (lines: number) => string; sizes?: number[] };
};

export const definePerfConfig = (config: PerfConfig) => config;
