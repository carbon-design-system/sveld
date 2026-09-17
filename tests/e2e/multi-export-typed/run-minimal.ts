import { sveld } from "sveld";

/**
 * Simulates `defineConfig({})`: types only, default writer options, separate outDir.
 * `inline: "local"` is still needed here (unlike most of this option set) because `TypedThing`'s
 * sibling `typed-thing-types.ts` isn't copied alongside this separate `types-minimal` outDir; a
 * preserved relative import would point at a file that doesn't exist there.
 */
await sveld({
  json: false,
  markdown: false,
  typesOptions: {
    outDir: "types-minimal",
    inline: "local",
  },
});
