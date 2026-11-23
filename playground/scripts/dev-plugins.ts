// Bun's dev server links Carbon's stylesheet after the components' styles,
// so a cascade layer keeps it under the app's overrides.
import type { BunPlugin } from "bun";

const CARBON_CSS = /[\\/]carbon-components-svelte[\\/]css[\\/]all\.css$/;

export default {
  name: "carbon-stylesheet",
  setup(build) {
    build.onLoad({ filter: CARBON_CSS }, async (args) => {
      const css = (await Bun.file(args.path).text()).replaceAll("font-display:auto", "font-display:swap");
      return { contents: `@layer carbon{${css}}`, loader: "css" };
    });
  },
} satisfies BunPlugin;
