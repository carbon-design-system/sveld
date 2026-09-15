import { type Dirent, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
