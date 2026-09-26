import { sveltekit } from "@sveltejs/kit/vite";
import sveld from "sveld";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit(),
    sveld({
      types: true,
      json: true,
      markdown: true,
    }),
  ],
});
