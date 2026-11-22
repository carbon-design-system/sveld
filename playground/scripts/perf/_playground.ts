// The playground's scripted interactions, shared by the scripts that drive it.

export type Step = { label: string; run: (view: Bun.WebView) => Promise<unknown> };

// Labelled by its tooltip; the header's only button action.
export const THEME_TOGGLE = "button.bx--header__action";

/** One interaction each: tab switches, picking an example, typing, the theme. */
export const STEPS: Step[] = [
  { label: "JSON tab", run: (v) => v.click(".bx--tabs__nav-item:nth-of-type(2) a") },
  { label: "Markdown tab", run: (v) => v.click(".bx--tabs__nav-item:nth-of-type(3) a") },
  { label: "TypeScript tab", run: (v) => v.click(".bx--tabs__nav-item:nth-of-type(1) a") },
  { label: "open dropdown", run: (v) => v.click(".bx--dropdown") },
  { label: "pick example", run: (v) => v.click(".bx--list-box__menu-item:nth-of-type(5)") },
  { label: "focus editor", run: (v) => v.click(".code-editor code") },
  { label: "type in editor", run: (v) => v.press("Enter") },
  { label: "toggle theme", run: (v) => v.click(THEME_TOGGLE) },
];

/** Waits until the page marks hydration (or loads, if it never does). */
export const HYDRATED = `performance.getEntriesByName("hydrated").length > 0 || document.readyState === "complete"`;
