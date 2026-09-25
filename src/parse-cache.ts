import { hash as cryptoHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { version as sveldVersion } from "../package.json";
import type { ParsedComponent, ParsedComponentTypeScriptMetadata } from "./ComponentParser";
import { PARSED_COMPONENT_TYPE_SCRIPT_METADATA } from "./parsed-component-metadata";
import { VERSION as svelteVersion } from "./svelte-version";

/** Bumped whenever the on-disk cache shape changes in a way old caches can't read. */
const CACHE_FORMAT_VERSION = 5;

/** Default on-disk location for the persistent parse cache, relative to the project root. */
export const DEFAULT_CACHE_FILE = join("node_modules", ".cache", "sveld", "parse-cache.json");

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
   * serialized emit options since those change the output shape.
   */
  generatedText?: { key: string; text: string };
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

/**
 * The directory of the nearest `package.json` at or above `dir`, or `dir`
 * itself when there's none. The input is often `src/`; the cache belongs next
 * to the project's own `node_modules`, not in a new one inside `src/`.
 */
function findProjectRoot(dir: string): string {
  for (let current = resolve(dir); ; current = dirname(current)) {
    if (existsSync(join(current, "package.json"))) return current;
    if (dirname(current) === current) return resolve(dir);
  }
}

/**
 * Resolves the effective cache file path for `cache: true | string`. A
 * relative path is resolved against the project root (see `findProjectRoot`).
 */
export function resolveCacheFilePath(rootDir: string, cache: boolean | string): string {
  const projectRoot = findProjectRoot(rootDir);
  if (typeof cache === "string") {
    return isAbsolute(cache) ? cache : resolve(projectRoot, cache);
  }
  return resolve(projectRoot, DEFAULT_CACHE_FILE);
}

export function hashSource(source: string): string {
  return cryptoHash("sha256", source, "hex");
}

function emptyCacheFile(): ParseCacheFile {
  return { formatVersion: CACHE_FORMAT_VERSION, toolchainVersion: currentToolchainVersion(), entries: {} };
}

function readCacheFile(cacheFilePath: string): ParseCacheFile {
  try {
    const raw = readFileSync(cacheFilePath, "utf-8");
    const parsed = JSON.parse(raw) as ParseCacheFile;
    if (parsed.formatVersion !== CACHE_FORMAT_VERSION || parsed.toolchainVersion !== currentToolchainVersion()) {
      return emptyCacheFile();
    }
    return parsed;
  } catch {
    // Missing, unreadable, or corrupt cache file: start fresh.
    return emptyCacheFile();
  }
}

/**
 * Cross-run parse cache. Entries match on file path and sha256 of source.
 * Symbol-keyed TypeScript metadata is stored separately because JSON drops symbols.
 */
export class ParseCache {
  private readonly cacheFilePath: string;
  private readonly file: ParseCacheFile;
  private readonly next = new Map<string, ParseCacheEntry>();
  /** Paths forced to miss this run (e.g. dependents of a changed `@extends` target). */
  private readonly blocked = new Set<string>();

  constructor(cacheFilePath: string) {
    this.cacheFilePath = cacheFilePath;
    this.file = readCacheFile(cacheFilePath);
  }

  /** True when `get()` would return a hit for `resolvedPath` and `hash`. */
  has(resolvedPath: string, hash: string): boolean {
    if (this.blocked.has(resolvedPath)) return false;
    const entry = this.file.entries[resolvedPath];
    return entry !== undefined && entry.hash === hash;
  }

  /** Returns the cached parse for `resolvedPath` when its content hash still matches. */
  get(resolvedPath: string, hash: string): ParsedComponent | null {
    if (this.blocked.has(resolvedPath)) return null;

    const entry = this.file.entries[resolvedPath];
    if (entry === undefined || entry.hash !== hash) return null;

    // Keep the entry for save() even if nothing else touches it this run.
    this.next.set(resolvedPath, entry);

    // Hand out a copy: the cross-file passes in `generateBundle` resolve
    // props and diagnostics in place, and those results must not be saved
    // as if they came from this file's source alone.
    const parsed = structuredClone(entry.parsed);
    if (entry.typeScriptMetadata !== undefined) {
      parsed[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = structuredClone(entry.typeScriptMetadata);
    }
    return parsed;
  }

  /**
   * Records a freshly parsed component so it can be reused on a future run.
   * Stores a copy, for the same reason `get()` returns one.
   */
  set(resolvedPath: string, hash: string, parsed: ParsedComponent): void {
    const typeScriptMetadata = parsed[PARSED_COMPONENT_TYPE_SCRIPT_METADATA];
    this.next.set(resolvedPath, {
      hash,
      parsed: structuredClone(parsed),
      typeScriptMetadata: typeScriptMetadata === undefined ? undefined : structuredClone(typeScriptMetadata),
    });
  }

  /** Skip cache for `resolvedPath` this run (e.g. an @extends dependent). */
  invalidate(resolvedPath: string): void {
    this.blocked.add(resolvedPath);
  }

  /**
   * Returns the cached generated `.d.ts` text for `resolvedPath`, if this
   * run's parse entry for it (a fresh parse or a hash-verified hit - see
   * `get()`/`set()`) already carries text generated for `key`, the
   * serialized emit options (see `serializeEmitOptions`).
   */
  getGeneratedText(resolvedPath: string, key: string): string | undefined {
    const entry = this.next.get(resolvedPath);
    if (entry?.generatedText === undefined || entry.generatedText.key !== key) return undefined;
    return entry.generatedText.text;
  }

  /**
   * Records generated `.d.ts` text against this run's parse entry for
   * `resolvedPath`. No-op if that entry hasn't been recorded via `get()`/`set()`
   * (shouldn't happen: the write phase only runs after every component has
   * been parsed).
   */
  setGeneratedText(resolvedPath: string, key: string, text: string): void {
    const entry = this.next.get(resolvedPath);
    if (entry === undefined) return;
    entry.generatedText = { key, text };
  }

  /**
   * Persists this run's cache entries back to disk. Writes to a pid-suffixed
   * temp file and renames it over the target so concurrent sveld processes
   * sharing a cache dir can't interleave writes into a truncated file; a
   * failed rename (e.g. read-only cache dir) falls back to a direct write so
   * generation never fails just because the cache couldn't be saved.
   */
  save(): void {
    mkdirSync(dirname(this.cacheFilePath), { recursive: true });
    const file: ParseCacheFile = {
      formatVersion: CACHE_FORMAT_VERSION,
      toolchainVersion: currentToolchainVersion(),
      entries: Object.fromEntries(this.next),
    };
    const contents = JSON.stringify(file);
    const tmpPath = `${this.cacheFilePath}.${process.pid}.tmp`;
    try {
      writeFileSync(tmpPath, contents);
      renameSync(tmpPath, this.cacheFilePath);
    } catch {
      try {
        writeFileSync(this.cacheFilePath, contents);
      } catch {
        // Cache dir is unwritable (e.g. read-only): skip persisting rather than fail generation.
      }
    }
  }
}
