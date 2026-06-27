// Component; documented separately.
export { default as Button } from "./Button.svelte";

export { MAX_RETRIES, VERSION } from "./constants";
export type { Theme, ThemeConfig } from "./types";
export { clamp, invertTheme } from "./utils";

/** Default theme applied when none is configured. */
export const DEFAULT_THEME = "light";
