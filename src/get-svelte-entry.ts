import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { asSvelteEntryPoint, type SvelteEntryPoint } from "./brands";
import { type ParsedPackageJson, parsePackageJson } from "./validate";

export type { SvelteEntryPoint };

export const UNRESOLVED_ENTRY_MESSAGE =
  'sveld: could not resolve a Svelte entry point. Set package.json#svelte, or pass the "entry" option.';

/**
 * The entry point, or why there isn't one. `configured` is false when
 * nothing named an entry (no `entry`, no `package.json#svelte`), the one
 * case where the CLI may fall back to `src/index.js`; a configured entry
 * that doesn't exist is always an error.
 */
type SvelteEntryResolution = { entry: SvelteEntryPoint } | { entry: null; configured: boolean; message: string };

function fromCwd(path: string): string {
  return isAbsolute(path) ? path : join(process.cwd(), path);
}

export function resolveSvelteEntry(entryPoint?: string): SvelteEntryResolution {
  if (entryPoint) {
    const entryPath = fromCwd(entryPoint);
    if (existsSync(entryPath)) return { entry: asSvelteEntryPoint(entryPoint) };
    return {
      entry: null,
      configured: true,
      message: `Invalid entry point: ${entryPath}. Pass a valid --entry (or "entry" option), or unset it and set the "svelte" field in your package.json instead.`,
    };
  }

  const pkg_path = join(process.cwd(), "package.json");

  if (!existsSync(pkg_path)) {
    return {
      entry: null,
      configured: false,
      message: 'Could not locate a package.json file. Specify an entry point with --entry (or the "entry" option).',
    };
  }

  let pkg: ParsedPackageJson;
  try {
    pkg = parsePackageJson(JSON.parse(readFileSync(pkg_path, "utf-8")));
  } catch (error) {
    console.error("Error reading package.json:", error);
    throw error;
  }
  const svelteField = pkg.svelte?.trim();

  if (!svelteField) {
    return {
      entry: null,
      configured: false,
      message:
        'Could not determine an entry point. Set the "svelte" field in your package.json, or pass --entry (or the "entry" option).',
    };
  }

  if (!existsSync(fromCwd(svelteField))) {
    return {
      entry: null,
      configured: true,
      message: `The "svelte" field in package.json points to "${svelteField}", which does not exist.`,
    };
  }

  return { entry: asSvelteEntryPoint(svelteField) };
}

/** {@link resolveSvelteEntry}, printing the reason to stderr when there's no entry. */
export function getSvelteEntry(entryPoint?: string): SvelteEntryPoint | null {
  const resolution = resolveSvelteEntry(entryPoint);
  if (resolution.entry === null) console.error(resolution.message);
  return resolution.entry;
}
