import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { version as sveldVersion } from "../package.json";
import type { ParsedComponent, ParsedComponentTypeScriptMetadata } from "./ComponentParser";
import { PARSED_COMPONENT_TYPE_SCRIPT_METADATA } from "./parsed-component-metadata";
import { VERSION as svelteVersion } from "./svelte-version";

/** Bumped whenever the on-disk cache shape changes in a way old caches can't read. */
const CACHE_FORMAT_VERSION = 2;

/** Default on-disk location for the persistent parse cache, relative to the project root. */
export const DEFAULT_CACHE_FILE = join("node_modules", ".cache", "sveld", "parse-cache.json");

/**
 * Machine-wide cache shared across every project/worktree/clone, so a
 * first-ever parse in a fresh checkout can still hit a component that some
 * other project already parsed with the same toolchain. Keyed purely by
 * content hash (see `ParseCache`'s global layer), unlike the project-local
 * cache which is keyed by file path.
 *
 * The file name itself is partitioned by `currentToolchainVersion()`, so two
 * worktrees on different sveld/Svelte versions (the upgrade case worktrees
 * exist for) get separate files instead of taking turns wiping each other's
 * entries every time either one writes (the stale-toolchain branch in
 * `readCacheFile` resets in memory, and a naive merge-then-write would
 * persist that reset, discarding the other version's entries).
 *
 * @throws if `homedir()` can't determine a home directory (no `$HOME` /
 * `$USERPROFILE` and no resolvable passwd entry) and `$XDG_CACHE_HOME` isn't
 * set either. Callers must treat that as "disable the global layer," not let
 * it fail the run — see the try/catch around this call in `bundle.ts`.
 */
export function resolveGlobalCacheFilePath(): string {
  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  const cacheHome = xdgCacheHome !== undefined && xdgCacheHome.trim() !== "" ? xdgCacheHome : join(homedir(), ".cache");
  return join(cacheHome, "sveld", `parse-cache-${sanitizeForFilename(currentToolchainVersion())}.json`);
}

/** Replaces characters that are reserved/unsafe in a file name on any major OS with `_`. */
function sanitizeForFilename(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: deliberately stripping control characters from a filename component
  return value.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_");
}

/** Hard cap on the global cache's entry count; oldest entries are culled past this. */
const GLOBAL_CACHE_MAX_ENTRIES = 5000;

/** One cached parse for a component file. */
interface ParseCacheEntry {
  /** sha256 of the raw source at cache time. */
  hash: string;
  parsed: ParsedComponent;
  /**
   * `parsed[PARSED_COMPONENT_TYPE_SCRIPT_METADATA]`, captured explicitly:
   * `JSON.stringify` drops symbol-keyed properties, so it can't ride along
   * on `parsed` through a disk round-trip.
   */
  typeScriptMetadata?: ParsedComponentTypeScriptMetadata;
  /**
   * Generated `.d.ts` text for this entry's `hash`, keyed additionally by the
   * effective `types-format` option since that changes the output shape.
   */
  generatedText?: { format: string; text: string };
}

interface ParseCacheFile {
  formatVersion: number;
  /** Invalidates the whole cache when sveld or the Svelte compiler upgrades. */
  toolchainVersion: string;
  entries: Record<string, ParseCacheEntry>;
}

function currentToolchainVersion(): string {
  return `${sveldVersion}+svelte@${svelteVersion}`;
}

/** Resolves the effective cache file path for `cache: true | string`. */
export function resolveCacheFilePath(rootDir: string, cache: boolean | string): string {
  if (typeof cache === "string") {
    return isAbsolute(cache) ? cache : resolve(rootDir, cache);
  }
  return resolve(rootDir, DEFAULT_CACHE_FILE);
}

export function hashSource(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function emptyCacheFile(): ParseCacheFile {
  return { formatVersion: CACHE_FORMAT_VERSION, toolchainVersion: currentToolchainVersion(), entries: {} };
}

function readCacheFile(cacheFilePath: string): ParseCacheFile {
  try {
    const raw = readFileSync(cacheFilePath, "utf-8");
    const parsed = JSON.parse(raw) as ParseCacheFile;
    if (
      parsed.formatVersion !== CACHE_FORMAT_VERSION ||
      parsed.toolchainVersion !== currentToolchainVersion() ||
      typeof parsed.entries !== "object" ||
      parsed.entries === null ||
      Array.isArray(parsed.entries)
    ) {
      return emptyCacheFile();
    }
    return parsed;
  } catch {
    // Missing, unreadable, or corrupt cache file: start fresh.
    return emptyCacheFile();
  }
}

/**
 * Validates an `entries[key]` lookup before trusting it as a hit. `readCacheFile`
 * only checks the file-level shape (`entries` itself); a single malformed
 * entry — hand-edited, from a future/foreign cache format, or a rare
 * concurrent-writer race — must not crash the run just because it parsed as
 * valid JSON. This is the only place `entry.parsed` is dereferenced after a
 * lookup, on purpose: every caller goes through here first.
 */
function isValidCacheHit(entry: unknown, hash: string): entry is ParseCacheEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const candidate = entry as Partial<ParseCacheEntry>;
  return typeof candidate.hash === "string" && candidate.hash === hash && isPlainObject(candidate.parsed);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Writes `file` to `cacheFilePath` via write-tmp+rename so a concurrent reader never sees a torn file. */
function writeCacheFileAtomic(cacheFilePath: string, file: ParseCacheFile): void {
  mkdirSync(dirname(cacheFilePath), { recursive: true });
  const tmpPath = `${cacheFilePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(file));
  renameSync(tmpPath, cacheFilePath);
}

/**
 * Merges `fresh` global-cache entries into whatever is currently on disk
 * (re-read right before writing, so a concurrent sveld process/project isn't
 * clobbered) and culls down to `GLOBAL_CACHE_MAX_ENTRIES` if needed.
 *
 * Re-inserting every touched key (`delete` + re-`set`) moves it to the end
 * of key-insertion order, so culling from the front approximates evicting
 * the least-recently-written entries. This is a machine-wide, multi-process
 * shared file, so best-effort merge semantics (occasional lost updates
 * between racing writers) are acceptable; failures are swallowed since the
 * global cache is a pure optimization, never a hard dependency.
 */
function saveGlobalCacheFile(globalCacheFilePath: string, fresh: Map<string, ParseCacheEntry>): void {
  try {
    const onDisk = readCacheFile(globalCacheFilePath);
    const merged = onDisk.entries;
    for (const [hash, entry] of fresh) {
      delete merged[hash];
      merged[hash] = entry;
    }

    const keys = Object.keys(merged);
    if (keys.length > GLOBAL_CACHE_MAX_ENTRIES) {
      for (const key of keys.slice(0, keys.length - GLOBAL_CACHE_MAX_ENTRIES)) {
        delete merged[key];
      }
    }

    writeCacheFileAtomic(globalCacheFilePath, {
      formatVersion: CACHE_FORMAT_VERSION,
      toolchainVersion: currentToolchainVersion(),
      entries: merged,
    });
  } catch {
    // Best-effort: a read-only $HOME, full disk, etc. must not fail the run.
  }
}

/**
 * Cross-run parse cache. Entries match on file path and sha256 of source.
 * Symbol-keyed TypeScript metadata is stored separately because JSON drops symbols.
 *
 * Optionally layers a second, machine-wide cache (see `resolveGlobalCacheFilePath`)
 * keyed purely by content hash instead of path, so a fresh clone/worktree can
 * still hit a component some other project already parsed with the same
 * toolchain. A component that reaches outside its own source — currently
 * only `@extendProps`/`@extends` — is excluded from the global layer, since
 * its parsed output isn't a pure function of its own hash.
 */
export class ParseCache {
  private readonly cacheFilePath: string;
  private readonly file: ParseCacheFile;
  private readonly next = new Map<string, ParseCacheEntry>();
  /** Paths forced to miss this run (e.g. dependents of a changed `@extends` target). */
  private readonly blocked = new Set<string>();

  private readonly globalCacheFilePath: string | undefined;
  /**
   * Lazily populated on the first local miss — `undefined` means either "the
   * global layer is disabled" (`globalCacheFilePath` unset) or "not read
   * yet." A fully local-hit run must never read this file at all, so the
   * constructor does not touch it; see `loadGlobalFile`.
   */
  private globalFile: ParseCacheFile | undefined;
  /** Entries this run has confirmed are safe to (re-)persist into the global cache, keyed by hash. */
  private readonly nextGlobal = new Map<string, ParseCacheEntry>();

  constructor(cacheFilePath: string, globalCacheFilePath?: string) {
    this.cacheFilePath = cacheFilePath;
    this.file = readCacheFile(cacheFilePath);
    this.globalCacheFilePath = globalCacheFilePath;
  }

  /** Reads and memoizes the global cache file on first use; a no-op once loaded, and never called when disabled. */
  private loadGlobalFile(): ParseCacheFile | undefined {
    if (this.globalCacheFilePath === undefined) return undefined;
    if (this.globalFile === undefined) {
      this.globalFile = readCacheFile(this.globalCacheFilePath);
    }
    return this.globalFile;
  }

  /** True when `get()` would return a hit for `resolvedPath` and `hash`. */
  has(resolvedPath: string, hash: string): boolean {
    if (this.blocked.has(resolvedPath)) return false;
    if (isValidCacheHit(this.file.entries[resolvedPath], hash)) return true;
    // Only consult (and thereby load) the global file on a local miss, so a
    // fully warm run never reads it.
    return isValidCacheHit(this.loadGlobalFile()?.entries[hash], hash);
  }

  /** Returns the cached parse for `resolvedPath` when its content hash still matches. */
  get(resolvedPath: string, hash: string): ParsedComponent | null {
    if (this.blocked.has(resolvedPath)) return null;

    const local = this.file.entries[resolvedPath];
    if (isValidCacheHit(local, hash)) {
      // Keep the entry for save() even if nothing else touches it this run.
      this.next.set(resolvedPath, local);
      if (local.typeScriptMetadata !== undefined) {
        local.parsed[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = local.typeScriptMetadata;
      }
      return local.parsed;
    }

    const global = this.loadGlobalFile()?.entries[hash];
    if (!isValidCacheHit(global, hash)) return null;

    // Two different local paths can hash to the same global entry (identical
    // source bytes), so this must be a fresh copy per path, not the shared
    // global-file object — otherwise `setGeneratedText` on one path (or the
    // symbol-keyed metadata reattachment below) leaks into the other.
    // Deliberately does NOT re-promote to the global cache too (see
    // `promoteToGlobal`) — a hit means the entry is already there, and
    // rewriting the global file on every run, including fully-warm ones,
    // would cost exactly the I/O this cache exists to avoid.
    const copy: ParseCacheEntry = {
      hash,
      parsed: structuredClone(global.parsed),
      typeScriptMetadata:
        global.typeScriptMetadata === undefined ? undefined : structuredClone(global.typeScriptMetadata),
    };
    this.next.set(resolvedPath, copy);
    if (copy.typeScriptMetadata !== undefined) {
      copy.parsed[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = copy.typeScriptMetadata;
    }
    return copy.parsed;
  }

  /** Records a freshly parsed component so it can be reused on a future run. */
  set(resolvedPath: string, hash: string, parsed: ParsedComponent): void {
    const entry: ParseCacheEntry = {
      hash,
      parsed,
      typeScriptMetadata: parsed[PARSED_COMPONENT_TYPE_SCRIPT_METADATA],
    };
    this.next.set(resolvedPath, entry);
    this.promoteToGlobal(hash, entry);
  }

  /**
   * Stages a freshly parsed `entry` for the global cache. Only called from
   * `set()` (fresh parses), not `get()` (hits) — the entry's already there
   * on a hit, so re-staging it would force a global-file rewrite on every
   * run, including fully-warm ones with nothing new to contribute.
   *
   * Skips components whose parsed output depends on another file's content
   * (`@extendProps`/`@extends`) — unsafe to key on this file's own hash alone.
   *
   * `structuredClone`s `parsed`/`typeScriptMetadata` rather than storing
   * `entry`'s own references: this same logical entry, reachable via `next`,
   * is later mutated in place — `setGeneratedText`, but also (outside this
   * class) `resolveTypes` and call-default resolution, both of which run
   * after `generateBundle`'s own `save()` and push/patch `parsed.props`
   * in place using data scoped to *this* project (siblings, tsconfig). A
   * second `save()` (CLI/plugin, after `writeOutput`) must not carry that
   * project-specific mutation into a cache another project's fresh checkout
   * will hash-hit into.
   */
  private promoteToGlobal(hash: string, entry: ParseCacheEntry): void {
    if (this.globalCacheFilePath === undefined) return;
    if (entry.parsed.extends !== undefined) return;
    this.nextGlobal.set(hash, {
      hash,
      parsed: structuredClone(entry.parsed),
      typeScriptMetadata:
        entry.typeScriptMetadata === undefined ? undefined : structuredClone(entry.typeScriptMetadata),
    });
  }

  /** Skip cache for `resolvedPath` this run (e.g. an @extends dependent). */
  invalidate(resolvedPath: string): void {
    this.blocked.add(resolvedPath);
  }

  /**
   * Returns the cached generated `.d.ts` text for `resolvedPath`, if this
   * run's parse entry for it (a fresh parse or a hash-verified hit — see
   * `get()`/`set()`) already carries text generated for `format`.
   */
  getGeneratedText(resolvedPath: string, format: string): string | undefined {
    const entry = this.next.get(resolvedPath);
    if (entry?.generatedText === undefined || entry.generatedText.format !== format) return undefined;
    return entry.generatedText.text;
  }

  /**
   * Records generated `.d.ts` text against this run's parse entry for
   * `resolvedPath`. No-op if that entry hasn't been recorded via `get()`/`set()`
   * (shouldn't happen: the write phase only runs after every component has
   * been parsed).
   */
  setGeneratedText(resolvedPath: string, format: string, text: string): void {
    const entry = this.next.get(resolvedPath);
    if (entry === undefined) return;
    entry.generatedText = { format, text };
  }

  /**
   * Persists this run's cache entries back to disk (project-local, plus the
   * global layer if enabled). Safe to call more than once in a run (the CLI
   * and the Vite plugin both do, to persist generated `.d.ts` text cached
   * after `writeOutput`) — `nextGlobal` is cleared after every global write
   * so a later call can't re-persist the same (by then possibly
   * project-mutated, see `promoteToGlobal`) entries a second time.
   */
  save(): void {
    writeCacheFileAtomic(this.cacheFilePath, {
      formatVersion: CACHE_FORMAT_VERSION,
      toolchainVersion: currentToolchainVersion(),
      entries: Object.fromEntries(this.next),
    });

    if (this.globalCacheFilePath !== undefined && this.nextGlobal.size > 0) {
      saveGlobalCacheFile(this.globalCacheFilePath, this.nextGlobal);
      this.nextGlobal.clear();
    }
  }
}
