import * as fs from "fs";
import * as path from "path";

export type SvelteEntryPoint = string;

/**
 * Get the file path entry point for uncompiled Svelte source code
 * Expects a "svelte" field in the consumer's `package.json`
 */
export function getSvelteEntry(entryPoint?: SvelteEntryPoint): SvelteEntryPoint | null {
  if (entryPoint) {
    const entry_path = path.join(process.cwd(), entryPoint);

    if (fs.existsSync(entry_path)) {
      return entryPoint;
    } else {
      process.stdout.write(`Invalid entry point: ${entry_path}.\n`);
      return null;
    }
  }

  const pkg_path = path.join(process.cwd(), "package.json");

  if (fs.existsSync(pkg_path)) {
    const pkg: { svelte?: SvelteEntryPoint } = JSON.parse(fs.readFileSync(pkg_path, "utf-8"));

    if (pkg.svelte !== undefined) return pkg.svelte;

    process.stdout.write("Could not determine an entry point.\n");
    process.stdout.write('Specify an entry point to your Svelte code in the "svelte" field of your package.json.\n');
    return null;
  } else {
    process.stdout.write("Could not locate a package.json file.\n");
    return null;
  }
}
