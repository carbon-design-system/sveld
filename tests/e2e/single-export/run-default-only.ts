import { sveld } from "sveld";

/** Entry is `export { default } from "./Button.svelte"` — no named re-export. */
await sveld({
  entry: "component/default-only.js",
  json: false,
  markdown: false,
  typesOptions: {
    outDir: "types-default-only",
  },
});
