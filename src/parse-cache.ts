import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { VERSION as svelteVersion } from "svelte/compiler";
import { version as sveldVersion } from "../package.json";
import {
  PARSED_COMPONENT_TYPE_SCRIPT_METADATA,
  type ParsedComponent,
  type ParsedComponentTypeScriptMetadata,
} from "./ComponentParser";

/** Bumped whenever the on-disk cache shape changes in a way old caches can't read. */
const CACHE_FORMAT_VERSION = 1;

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

    if (entry.typeScriptMetadata !== undefined) {
      entry.parsed[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = entry.typeScriptMetadata;
    }
    return entry.parsed;
  }

  /** Records a freshly parsed component so it can be reused on a future run. */
  set(resolvedPath: string, hash: string, parsed: ParsedComponent): void {
    this.next.set(resolvedPath, {
      hash,
      parsed,
      typeScriptMetadata: parsed[PARSED_COMPONENT_TYPE_SCRIPT_METADATA],
    });
  }

  /** Skip cache for `resolvedPath` this run (e.g. an @extends dependent). */
  invalidate(resolvedPath: string): void {
    this.blocked.add(resolvedPath);
  }

  /** Persists this run's cache entries back to disk. */
  save(): void {
    mkdirSync(dirname(this.cacheFilePath), { recursive: true });
    const file: ParseCacheFile = {
      formatVersion: CACHE_FORMAT_VERSION,
      toolchainVersion: currentToolchainVersion(),
      entries: Object.fromEntries(this.next),
    };
    writeFileSync(this.cacheFilePath, JSON.stringify(file));
  }
}
