import { hash as cryptoHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { version as sveldVersion } from "../package.json";
import type {
  ComponentParseResult,
  ParsedComponent,
  ParsedComponentTypeScriptMetadata,
  PendingCrossFileCandidates,
} from "./model";
import { PARSED_COMPONENT_TYPE_SCRIPT_METADATA } from "./parsed-component-metadata";
import { VERSION as svelteVersion } from "./svelte-version";

/** Bumped whenever the on-disk cache shape changes in a way old caches can't read. */
const CACHE_FORMAT_VERSION = 10;

/** Relative to the project root. */
export const DEFAULT_CACHE_FILE = join("node_modules", ".cache", "sveld", "parse-cache.json");

interface ParseCacheEntry {
  /** sha256 of the source. */
  hash: string;
  component: ParsedComponent;
  /** `component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA]`: JSON drops symbol keys. */
  typeScriptMetadata?: ParsedComponentTypeScriptMetadata;
  pending?: PendingCrossFileCandidates;
  /** Generated `.d.ts` text, keyed by the serialized emit options. */
  generatedText?: { key: string; text: string };
}

interface ParseCacheFile {
  formatVersion: number;
  toolchainVersion: string;
  entries: Record<string, ParseCacheEntry>;
}

/** Replaced at build time (`scripts/build.ts`) with a fingerprint of `src/`. */
declare const __SVELD_BUILD_ID__: string | undefined;

/** Unset when running from source, where tests use fresh caches anyway. */
const BUILD_ID = typeof __SVELD_BUILD_ID__ === "string" ? __SVELD_BUILD_ID__ : "source";

function currentToolchainVersion(): string {
  return `${sveldVersion}+${BUILD_ID}+svelte@${svelteVersion}`;
}

/**
 * The nearest `package.json` directory at or above `dir`, else `dir`. The
 * input is often `src/`, and the cache belongs in the project's `node_modules`.
 */
function findProjectRoot(dir: string): string {
  for (let current = resolve(dir); ; current = dirname(current)) {
    if (existsSync(join(current, "package.json"))) return current;
    if (dirname(current) === current) return resolve(dir);
  }
}

/** A relative `cache` path resolves against the project root. */
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
    const parsed = JSON.parse(readFileSync(cacheFilePath, "utf-8")) as ParseCacheFile;
    if (parsed.formatVersion !== CACHE_FORMAT_VERSION || parsed.toolchainVersion !== currentToolchainVersion()) {
      return emptyCacheFile();
    }
    return parsed;
  } catch {
    return emptyCacheFile();
  }
}

/** Cross-run parse cache, matching entries on file path and source hash. */
export class ParseCache {
  private readonly cacheFilePath: string;
  private readonly file: ParseCacheFile;
  private readonly next = new Map<string, ParseCacheEntry>();
  /**
   * An entry was added or its generated text changed. Dropped entries show
   * up as `next.size < savedEntryCount` instead: without a `set()`, every
   * entry in `next` came from the file.
   */
  private dirty = false;
  private savedEntryCount: number;

  constructor(cacheFilePath: string) {
    this.cacheFilePath = cacheFilePath;
    this.file = readCacheFile(cacheFilePath);
    this.savedEntryCount = Object.keys(this.file.entries).length;
  }

  has(resolvedPath: string, hash: string): boolean {
    return this.lookup(resolvedPath, hash) !== undefined;
  }

  /** This run's entry first, so a long-lived cache (watch mode) sees files parsed this session. */
  private lookup(resolvedPath: string, hash: string): ParseCacheEntry | undefined {
    const current = this.next.get(resolvedPath);
    if (current?.hash === hash) return current;
    const saved = this.file.entries[resolvedPath];
    return saved?.hash === hash ? saved : undefined;
  }

  get(resolvedPath: string, hash: string): ComponentParseResult | null {
    const entry = this.lookup(resolvedPath, hash);
    if (entry === undefined) return null;

    // Keep the entry for save() even if nothing else touches it this run.
    this.next.set(resolvedPath, entry);

    // A copy: the cross-file passes mutate props and diagnostics in place, and
    // those results must not be saved as if they came from this source alone.
    const { component, typeScriptMetadata, pending } = structuredClone({
      component: entry.component,
      typeScriptMetadata: entry.typeScriptMetadata,
      pending: entry.pending,
    });
    if (typeScriptMetadata !== undefined) {
      component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = typeScriptMetadata;
    }
    return pending === undefined ? { component } : { component, pending };
  }

  /** Stores a copy, for the same reason `get()` returns one. */
  set(resolvedPath: string, hash: string, { component, pending }: ComponentParseResult): void {
    this.dirty = true;
    this.next.set(resolvedPath, {
      hash,
      ...structuredClone({
        component,
        typeScriptMetadata: component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA],
        pending,
      }),
    });
  }

  /** Reads this run's entry only, so the text is for the hash `get()`/`set()` verified. */
  getGeneratedText(resolvedPath: string, key: string): string | undefined {
    const entry = this.next.get(resolvedPath);
    if (entry?.generatedText === undefined || entry.generatedText.key !== key) return undefined;
    return entry.generatedText.text;
  }

  /** No-op without this run's entry, which the write phase always has. */
  setGeneratedText(resolvedPath: string, key: string, text: string): void {
    const entry = this.next.get(resolvedPath);
    if (entry === undefined) return;
    if (entry.generatedText?.key === key && entry.generatedText.text === text) return;
    entry.generatedText = { key, text };
    this.dirty = true;
  }

  /**
   * Writes a pid-suffixed temp file and renames it over the target, so
   * concurrent processes can't interleave a truncated file. A failed rename
   * falls back to a direct write; a failed write is dropped rather than
   * failing generation. Skipped when nothing changed since the last save.
   */
  save(): void {
    if (!this.dirty && this.next.size === this.savedEntryCount) return;
    this.dirty = false;
    this.savedEntryCount = this.next.size;

    mkdirSync(dirname(this.cacheFilePath), { recursive: true });
    const file: ParseCacheFile = { ...emptyCacheFile(), entries: Object.fromEntries(this.next) };
    const contents = JSON.stringify(file);
    const tmpPath = `${this.cacheFilePath}.${process.pid}.tmp`;
    try {
      writeFileSync(tmpPath, contents);
      renameSync(tmpPath, this.cacheFilePath);
    } catch {
      try {
        writeFileSync(this.cacheFilePath, contents);
      } catch {}
    }
  }
}
