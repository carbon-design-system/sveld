import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { asSvelteEntryPoint, type SvelteEntryPoint } from "./brands";
import { parsePackageJson } from "./validate";

export type { SvelteEntryPoint };

/** Resolve the Svelte entry from `entryPoint` or `package.json#svelte`. */
export function getSvelteEntry(entryPoint?: string): SvelteEntryPoint | null {
  if (entryPoint) {
    const entry_path = join(process.cwd(), entryPoint);

    if (existsSync(entry_path)) {
      return asSvelteEntryPoint(entryPoint);
    }

    console.log(`Invalid entry point: ${entry_path}.`);
    return null;
  }

  const pkg_path = join(process.cwd(), "package.json");

  if (!existsSync(pkg_path)) {
    console.log("Could not locate a package.json file.\n");
    return null;
  }

  try {
    const pkg = parsePackageJson(JSON.parse(readFileSync(pkg_path, "utf-8")));

    if (pkg.svelte?.trim()) {
      return asSvelteEntryPoint(pkg.svelte);
    }

    console.log("Could not determine an entry point.\n");
    console.log('Specify an entry point to your Svelte code in the "svelte" field of your package.json.\n');
    return null;
  } catch (error) {
    console.error("Error reading package.json:", error);
    throw error;
  }
}
