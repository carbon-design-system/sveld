import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SvelteEntryPoint = string;

/**
 * Get the file path entry point for uncompiled Svelte source code
 * Expects a "svelte" field in the consumer's `package.json`
 */
export function getSvelteEntry(entryPoint?: SvelteEntryPoint): SvelteEntryPoint | null {
  if (entryPoint) {
    const entry_path = join(process.cwd(), entryPoint);

    if (existsSync(entry_path)) {
      return entryPoint;
    } else {
      console.log(`Invalid entry point: ${entry_path}.`);
      return null;
    }
  }

  const pkg_path = join(process.cwd(), "package.json");

  if (!existsSync(pkg_path)) {
    console.log("Could not locate a package.json file.\n");
    return null;
  }

  try {
    const pkg: { svelte?: SvelteEntryPoint } = JSON.parse(readFileSync(pkg_path, "utf-8"));

    if (typeof pkg.svelte === "string" && pkg.svelte.trim()) {
      return pkg.svelte;
    }

    console.log("Could not determine an entry point.\n");
    console.log('Specify an entry point to your Svelte code in the "svelte" field of your package.json.\n');
    return null;
  } catch (error) {
    console.error("Error reading package.json:", error);
    throw error;
  }
}
