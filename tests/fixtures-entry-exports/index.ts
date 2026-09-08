// Component; documented separately.
export { default as Button } from "./Button.svelte";

export { MAX_RETRIES, VERSION } from "./constants";
export type { Theme, ThemeConfig } from "./types";
export { clamp, invertTheme } from "./utils";

/**
 * Default theme applied when none is configured.
 *
 * @deprecated Use `invertTheme` with an explicit theme instead.
 * @since 1.0.0
 */
export const DEFAULT_THEME = "light";
