// Settings for the perf scripts in scripts/perf: what's specific to this
// playground (its ready mark, selectors, lazy chunks and editor).
import { definePerfConfig } from "./scripts/perf/_define";

// Labelled by its tooltip; the header's only button action.
const THEME_TOGGLE = "button.bx--header__action";
const tab = (n: number) => `.bx--tabs__nav-item:nth-of-type(${n}) a`;

export default definePerfConfig({
  url: "https://sveld.onrender.com/",
  // src/index.ts sets it right after hydrate().
  readyMark: "hydrated",
  steps: [
    { label: "JSON tab", run: (v) => v.click(tab(2)) },
    { label: "Markdown tab", run: (v) => v.click(tab(3)) },
    { label: "TypeScript tab", run: (v) => v.click(tab(1)) },
    { label: "open dropdown", run: (v) => v.click(".bx--dropdown") },
    { label: "pick example", run: (v) => v.click(".bx--list-box__menu-item:nth-of-type(5)") },
    { label: "focus editor", run: (v) => v.click(".code-editor code") },
    { label: "type in editor", run: (v) => v.press("Enter") },
    { label: "toggle theme", run: (v) => v.click(THEME_TOGGLE) },
  ],
  actions: {
    theme: { run: (v) => v.click(THEME_TOGGLE) },
    tab: { run: (v) => v.click(tab(2)) },
    example: {
      setup: (v) => v.click(".bx--dropdown"),
      run: (v) => v.click(".bx--list-box__menu-item:nth-of-type(5)"),
    },
  },
  lazyUI: [
    { ui: "JSON tab", chunk: /\/TabJson-/ },
    { ui: "Markdown tab", chunk: /\/TabMarkdown-/ },
    { ui: "editing or picking an example", chunk: /\/parser-/ },
  ],
  element: { label: "editor colored", selector: ".code-editor code span[class^=hljs-]" },
  // Carbon's BEM blocks: `.bx--btn`, `.cds--modal`.
  cssBlock: /\.((?:bx|cds)--[a-z0-9]+(?:-[a-z0-9]+)*?)(?=__|--|[^\w-]|$)/,
  // Carbon's spinner and the overlay that stands in for a tab's output.
  loaders: [".bx--loading", ".bx--inline-loading"],
  intent: [
    {
      label: "pick an example (needs the parser)",
      // Pointing anywhere in the code column starts loading the parser.
      hover: ".bx--dropdown",
      steps: [(v) => v.click(".bx--dropdown"), (v) => v.click(".bx--list-box__menu-item:nth-of-type(5)")],
      chunk: /\/parser-/,
    },
  ],
  typing: {
    target: ".code-editor code",
    // A component with one prop per line, so sveld has more to document.
    fill: (lines) => {
      const props = Array.from({ length: Math.max(1, lines - 3) }, (_, i) => `  export let prop${i} = ${i};`);
      return ["<script>", ...props, "</script>", "<div>{prop0}</div>"].join("\n");
    },
    sizes: [10, 100, 1000],
  },
});
