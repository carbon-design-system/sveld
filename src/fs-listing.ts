import { type Dirent, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * One directory's entries. `byName` and `folded` are built on first use.
 */
interface DirectoryListing {
  entries: Dirent[];
  names: Set<string>;
  /** On-disk name -> entry; built on first {@link DirectoryListings.entry} lookup. */
  byName?: Map<string, Dirent>;
  /** Case-folded, NFC-normalized name -> on-disk name; built on first fuzzy lookup. */
  folded?: Map<string, string>;
}

function foldName(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

/**
 * One `readdirSync` per directory, shared by the glob walk and module
 * resolution. Both would otherwise list every component directory on their
 * own, and module resolution would `existsSync` each candidate extension
 * for every specifier instead of reading the listing once.
 *
 * A directory that could not be read (missing, not a directory, permission
 * denied) is remembered as unreadable. {@link clear} before any pass that
 * must see files created since the last one.
 */
export class DirectoryListings {
  private readonly listings = new Map<string, DirectoryListing | null>();

  clear(): void {
    this.listings.clear();
  }

  /** The entries of `dir`, or `null` when it can't be read. */
  entries(dir: string): Dirent[] | null {
    return this.read(dir)?.entries ?? null;
  }

  /**
   * The listing entry named exactly `name` in `dir`, or `undefined` when there
   * is none (including when only a case/normalization variant exists; see
   * {@link has} for that path). Lets callers read the entry's type from the
   * listing instead of `lstat`-ing the path again: like `lstat`, `readdir`
   * entry types describe a symlink itself, not its target.
   */
  entry(dir: string, name: string): Dirent | undefined {
    const listing = this.read(dir);
    if (listing === null) return undefined;
    if (listing.byName === undefined) {
      listing.byName = new Map();
      for (const entry of listing.entries) listing.byName.set(entry.name, entry);
    }
    return listing.byName.get(name);
  }

  /**
   * Whether `dir/name` exists, answered from the cached listing of `dir`. An
   * exact name match needs no syscall. A name that differs only by case or
   * Unicode normalization is confirmed with `existsSync`, so it still resolves
   * on case-insensitive filesystems (as probing the disk directly did) and is
   * rejected on case-sensitive ones.
   */
  has(dir: string, name: string): boolean {
    const listing = this.read(dir);
    if (listing === null) return false;
    if (listing.names.has(name)) return true;

    if (listing.folded === undefined) {
      listing.folded = new Map();
      for (const entryName of listing.names) listing.folded.set(foldName(entryName), entryName);
    }
    const sibling = listing.folded.get(foldName(name));
    return sibling !== undefined && sibling !== name && existsSync(join(dir, name));
  }

  private read(dir: string): DirectoryListing | null {
    let listing = this.listings.get(dir);
    if (listing !== undefined) return listing;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      const names = new Set<string>();
      for (const entry of entries) names.add(entry.name);
      listing = { entries, names };
    } catch {
      listing = null;
    }
    this.listings.set(dir, listing);
    return listing;
  }
}
