import { svelte } from "@sveltejs/vite-plugin-svelte";
import sveld from "sveld";
import { defineConfig } from "vite";

/** Class-format output (default) into types-class/ so it does not clobber component-format types/. */
export default defineConfig({
  plugins: [
    svelte(),
    sveld({
      types: true,
      typesOptions: {
        outDir: "types-class",
        printWidth: 80,
        format: "class",
      },
    }),
  ],
  build: {
    lib: {
      entry: "./src/index.js",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["svelte"],
    },
  },
});
