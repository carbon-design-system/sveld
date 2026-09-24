import { type Dirent, existsSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/**
 * One `readdirSync` per directory per discovery pass, shared by the glob walk
 * and module resolution. Both would otherwise list every component directory
 * on their own, and module resolution used to `existsSync` each candidate
 * extension for every barrel specifier instead of reading the listing once.
 *
 * `null` marks a directory that could not be read (missing, not a directory,
 * permission denied). Cleared via {@link resetDirectoryListings} before any
 * pass that must see files created since the last one.
 */
export interface DirectoryListing {
  entries: Dirent[];
  names: Set<string>;
  /** On-disk name -> entry; built on first {@link directoryEntry} lookup. */
  byName?: Map<string, Dirent>;
  /** Case-folded, NFC-normalized name -> on-disk name; built on first fuzzy lookup. */
  folded?: Map<string, string>;
}

const listings = new Map<string, DirectoryListing | null>();

export function resetDirectoryListings(): void {
  listings.clear();
}

export function readDirectoryListing(dir: string): DirectoryListing | null {
  let listing = listings.get(dir);
  if (listing !== undefined) return listing;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    const names = new Set<string>();
    for (const entry of entries) names.add(entry.name);
    listing = { entries, names };
  } catch {
    listing = null;
  }
  listings.set(dir, listing);
  return listing;
}

/**
 * The listing entry named exactly `name` in `dir`, or `undefined` when there
 * is none (including when only a case/normalization variant exists; see
 * {@link directoryHasEntry} for that path). Lets callers read the entry's
 * type from the listing instead of `lstat`-ing the path again: like `lstat`,
 * `readdir` entry types describe a symlink itself, not its target.
 */
export function directoryEntry(dir: string, name: string): Dirent | undefined {
  const listing = readDirectoryListing(dir);
  if (listing === null) return undefined;
  if (listing.byName === undefined) {
    listing.byName = new Map();
    for (const entry of listing.entries) listing.byName.set(entry.name, entry);
  }
  return listing.byName.get(name);
}

function foldName(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

/**
 * Whether `dir/name` exists, answered from the cached listing of `dir`. An
 * exact name match needs no syscall. A name that differs only by case or
 * Unicode normalization is confirmed with `existsSync`, so it still resolves
 * on case-insensitive filesystems (as probing the disk directly did) and is
 * rejected on case-sensitive ones.
 */
export function directoryHasEntry(dir: string, name: string): boolean {
  const listing = readDirectoryListing(dir);
  if (listing === null) return false;
  if (listing.names.has(name)) return true;

  if (listing.folded === undefined) {
    listing.folded = new Map();
    for (const entryName of listing.names) listing.folded.set(foldName(entryName), entryName);
  }
  const sibling = listing.folded.get(foldName(name));
  return sibling !== undefined && sibling !== name && existsSync(join(dir, name));
}

const JS_FAMILY_EXTENSION_REGEX = /\.[mc]?jsx?$/;

/** What each `.js`-family extension maps to under TypeScript's module resolution, in the order `tsc` tries them. */
const TYPESCRIPT_COUNTERPART_EXTENSIONS: Record<string, string[]> = {
  ".js": [".ts", ".tsx", ".d.ts"],
  ".jsx": [".tsx", ".d.ts"],
  ".mjs": [".mts", ".d.mts"],
  ".cjs": [".cts", ".d.cts"],
};

/**
 * The TypeScript file a `.js`-family path names when only that file exists:
 * TypeScript projects import `./util.ts` as `./util.js` (and a Svelte 5
 * `x.svelte.ts` module as `./x.svelte.js`), since that's the emitted name.
 */
export function typeScriptCounterpart(filePath: string): string | undefined {
  const extension = JS_FAMILY_EXTENSION_REGEX.exec(filePath)?.[0];
  if (extension === undefined) return undefined;

  const stem = filePath.slice(0, -extension.length);
  const dir = dirname(stem);
  const name = basename(stem);
  for (const candidate of TYPESCRIPT_COUNTERPART_EXTENSIONS[extension] ?? []) {
    if (directoryHasEntry(dir, name + candidate)) return stem + candidate;
  }
  return undefined;
}
