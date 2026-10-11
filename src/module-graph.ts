import { type Dirent, readFileSync, type Stats, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { type Program, parseModule as parseJavaScript } from "sveast";
import { DirectoryListings } from "./fs-listing";
import { warn } from "./logger";
import { formatParseError } from "./parse-error";
import { getParserStack } from "./parser-stack";
import { MODULE_EXTENSIONS } from "./path";
import { PathAliases } from "./resolve-alias";

const JS_FAMILY_EXTENSION_REGEX = /\.[mc]?jsx?$/;

/** What each `.js`-family extension maps to under TypeScript's module resolution, in the order `tsc` tries them. */
const TYPESCRIPT_COUNTERPART_EXTENSIONS: Record<string, string[]> = {
  ".js": [".ts", ".tsx", ".d.ts"],
  ".jsx": [".tsx", ".d.ts"],
  ".mjs": [".mts", ".d.mts"],
  ".cjs": [".cts", ".d.cts"],
};

export interface ModuleSource {
  /** The file's full text, which the AST offsets index into. */
  text: string;
  /** Absolute. */
  filePath: string;
  /** Resolves relative imports. */
  dir: string;
}

/** A module's text and top-level statements, or `null` when it can't be read or parsed. */
type ParsedModule = { source: ModuleSource; body: Program["body"] } | null;

/** As opposed to a bare package specifier. */
function isPathSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    isAbsolute(specifier)
  );
}

/**
 * The files one project reads besides its components: specifier resolution
 * and parses, cached for one build or watch session so nothing leaks into
 * the next. Export lookups (`module-exports.ts`) are cached per lookup
 * instead, since an import cycle leaves one lookup's view of a module incomplete.
 */
export class ModuleGraph {
  readonly aliases = new PathAliases();
  private readonly listings = new DirectoryListings();
  /** From the TypeScript-aware parser. */
  private readonly modules = new Map<string, ParsedModule>();
  /** The last plain-JavaScript AST per file, reused while its source is unchanged. */
  private readonly programs = new Map<string, { source: string; ast: Program }>();

  listDirectory(dir: string): Dirent[] | null {
    return this.listings.entries(dir);
  }

  exists(filePath: string): boolean {
    return this.listings.has(dirname(filePath), basename(filePath));
  }

  /**
   * Resolves a relative, absolute, or path-alias specifier to a file: the
   * path verbatim, then with each of `extensions`, then a directory's
   * `index.*`, then the `.ts` file a missing `.js` specifier stands for.
   */
  resolve(specifier: string, fromDir: string, extensions: readonly string[] = MODULE_EXTENSIONS): string | null {
    const aliased = this.aliases.absolute(specifier, fromDir);
    if (aliased === specifier && !isPathSpecifier(specifier)) return null;
    const base = resolve(fromDir, aliased);
    const parentDir = dirname(base);
    const baseName = basename(base);

    const exists = this.listings.has(parentDir, baseName);
    let stat: Dirent | Stats | undefined;
    if (exists) {
      // The listing knows the entry's type, except for a symlink's target or a
      // name matched by case/normalization variant.
      const entry = this.listings.entry(parentDir, baseName);
      stat = entry && !entry.isSymbolicLink() ? entry : statSync(base, { throwIfNoEntry: false });
      if (stat?.isFile()) return base;
    }

    for (const ext of extensions) {
      if (this.listings.has(parentDir, baseName + ext)) return base + ext;
    }

    if (!exists) return this.typeScriptCounterpart(base) ?? null;

    if (stat?.isDirectory()) {
      for (const ext of extensions) {
        if (this.listings.has(base, `index${ext}`)) return join(base, `index${ext}`);
      }
    }
    return null;
  }

  /** Needs the parser stack loaded. */
  parse(filePath: string): ParsedModule {
    let parsed = this.modules.get(filePath);
    if (parsed === undefined) {
      parsed = parseModule(filePath);
      this.modules.set(filePath, parsed);
    }
    return parsed;
  }

  /** Plain JavaScript, as a component barrel is read (TypeScript syntax throws). */
  parseJavaScript(filePath: string, source: string): Program {
    const cached = this.programs.get(filePath);
    if (cached?.source === source) return cached.ast;
    let ast: Program;
    try {
      ast = parseJavaScript(source);
    } catch (error) {
      throw new Error(formatParseError(error));
    }
    this.programs.set(filePath, { source, ast });
    return ast;
  }

  /** Also forgets every directory listing: an edit can add or remove files anywhere. */
  invalidate(...filePaths: string[]): void {
    this.listings.clear();
    for (const filePath of filePaths) {
      this.modules.delete(filePath);
      this.programs.delete(filePath);
    }
  }

  /**
   * The TypeScript file a `.js`-family path names when only that file exists:
   * TypeScript projects import `./util.ts` as `./util.js` (and a Svelte 5
   * `x.svelte.ts` module as `./x.svelte.js`), since that's the emitted name.
   */
  private typeScriptCounterpart(filePath: string): string | undefined {
    const extension = JS_FAMILY_EXTENSION_REGEX.exec(filePath)?.[0];
    if (extension === undefined) return undefined;

    const stem = filePath.slice(0, -extension.length);
    const dir = dirname(stem);
    const name = basename(stem);
    for (const candidate of TYPESCRIPT_COUNTERPART_EXTENSIONS[extension] ?? []) {
      if (this.listings.has(dir, name + candidate)) return stem + candidate;
    }
    return undefined;
  }
}

/**
 * TypeScript on (`.js` is valid input too). A `.svelte` file yields its
 * module script, the only place a component declares non-default exports.
 */
function parseModule(filePath: string): ParsedModule {
  let text: string;
  try {
    text = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  try {
    const body = filePath.endsWith(".svelte")
      ? (getParserStack().parseSvelteScripts(text).module?.content.body ?? [])
      : getParserStack().parseModule(text, { typescript: true }).body;
    return { source: { text, filePath, dir: dirname(filePath) }, body };
  } catch (error) {
    warn(`Warning: sveld couldn't parse ${filePath} to read its exports (${formatParseError(error)}); skipping it.`);
    return null;
  }
}
