import { sveld } from "sveld";

/** Simulates `defineConfig({})`: types only, default writer options, separate outDir. */
await sveld({
  json: false,
  markdown: false,
  typesOptions: {
    outDir: "types-minimal",
  },
});
