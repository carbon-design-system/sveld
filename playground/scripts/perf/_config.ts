// A project's settings for these scripts, from `perf.config.ts` in the
// working directory or the file given with `--config`. Everything is
// optional; each script says which settings it needs.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { PerfConfig } from "./_define";

export type { PerfConfig, Step } from "./_define";

async function load(): Promise<PerfConfig> {
  const at = process.argv.indexOf("--config");
  // Take `--config <file>` out, so the scripts' own argument parsing never sees it.
  const path = at === -1 ? "perf.config.ts" : process.argv.splice(at, 2)[1];
  const file = resolve(path ?? "perf.config.ts");
  if (!existsSync(file)) {
    if (at !== -1) throw new Error(`no config at ${file}`);
    return {};
  }
  return ((await import(file)) as { default: PerfConfig }).default;
}

export const config = await load();

/** `/assets/` and Vite's `name-[hash].ext` (an 8-character hash) unless configured. */
export const ASSETS = {
  path: config.assets?.path ?? "/assets/",
  hash: config.assets?.hash ?? /-[\w-]{8}(?=\.\w+$)/,
};

/** The ready mark's name, for reports. */
export const READY_LABEL = config.readyMark ?? "load";

/** True once the page set its ready mark, or once it loaded. */
export const READY = config.readyMark
  ? `performance.getEntriesByName(${JSON.stringify(config.readyMark)}).length > 0 || document.readyState === "complete"`
  : `document.readyState === "complete"`;

/** Page-side expression for the ready mark's time, or `load` without one. */
export const READY_TIME = config.readyMark
  ? `performance.getEntriesByName(${JSON.stringify(config.readyMark)})[0]?.startTime`
  : `performance.getEntriesByType("navigation")[0]?.loadEventEnd`;

/** Fails with a pointer to the setting a script needs. */
export function need<T>(value: T | undefined, setting: string, script: string): T {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    throw new Error(`${script} needs \`${setting}\` in perf.config.ts (or the file given with --config)`);
  }
  return value;
}
