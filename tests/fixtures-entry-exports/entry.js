// JS entry so the component-export parser, which reads JavaScript only, can
// read it. documentExports still picks up the rest.
export { default as Button } from "./Button.svelte";
export { MAX_RETRIES, VERSION } from "./constants";
export { Theme, ThemeConfig } from "./types";
export { clamp, invertTheme } from "./utils";

/** Default theme applied when none is configured. */
export const DEFAULT_THEME = "light";
