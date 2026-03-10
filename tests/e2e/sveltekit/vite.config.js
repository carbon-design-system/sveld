import { svelte } from "@sveltejs/vite-plugin-svelte";
import sveld from "sveld";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    svelte(),
    sveld({
      types: true,
      json: true,
      markdown: true,
    }),
  ],
  build: {
    lib: {
      entry: "./src/lib/index.js",
      formats: ["es"],
      fileName: "index",
    },
    outDir: "dist",
  },
});
