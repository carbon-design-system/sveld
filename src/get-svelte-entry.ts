import * as fs from "fs";
import * as path from "path";

export type SvelteEntryPoint = string;

/**
 * Get the file path entrypoint for uncompiled Svelte source code
 * Expects a "svelte" field in the consumer's `package.json`
 */
export function getSvelteEntry(): SvelteEntryPoint | null {
  const pkg_path = path.join(process.cwd(), "package.json");

  if (fs.existsSync(pkg_path)) {
    const pkg: { svelte?: SvelteEntryPoint } = JSON.parse(fs.readFileSync(pkg_path, "utf-8"));

    if (pkg.svelte !== undefined) return pkg.svelte;

    process.stdout.write("Could not determine an entrypoint.\n");
    process.stdout.write('Specify an entrypoint to your Svelte code in the "svelte" field of your package.json.\n');
    return null;
  } else {
    process.stdout.write("Could not locate a package.json file.\n");
    return null;
  }
}
