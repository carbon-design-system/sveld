import type { Dirent } from "node:fs";
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { type Program, parse as parseJavaScript } from "acorn";
import { DirectoryListings } from "./fs-listing";
import { warn } from "./logger";
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

/** Minimal AST node shape exposed by the Svelte/acorn-typescript parser. */
export interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** Parsed-source context shared while walking a single module. */
export interface ModuleSource {
  /** The file's full text, which the AST offsets index into. */
  text: string;
  /** Absolute path of the parsed file. */
  filePath: string;
  /** Directory used to resolve relative imports. */
  dir: string;
}

/** A module's text and top-level statements, or `null` when it can't be read or parsed. */
export type ParsedModule = { source: ModuleSource; body: AstNode[] } | null;

export function asNode(value: unknown): AstNode | undefined {
  return value && typeof value === "object" ? (value as AstNode) : undefined;
}

export function asNodeArray(value: unknown): AstNode[] {
  return Array.isArray(value) ? (value as AstNode[]) : [];
}

/** `./x`, `../x`, `.`, `..`, or an absolute path, as opposed to a bare package specifier. */
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
 * The files one project reads besides its components: how import
 * specifiers resolve to them, and their parses. Directory listings,
 * tsconfig/jsconfig `paths`, and parsed modules are cached for the
 * graph's lifetime, one build or watch session, so nothing a project read
 * leaks into the next.
 *
 * Export lookups build on {@link parse} in `module-exports.ts`; they're
 * cached per lookup rather than here, since an import cycle leaves one
 * lookup's view of a module incomplete.
 */
export class ModuleGraph {
  /** tsconfig/jsconfig `paths` mappings. */
  readonly aliases = new PathAliases();
  private readonly listings = new DirectoryListings();
  /** Per file: its text and top-level statements, from the TypeScript-aware parser. */
  private readonly modules = new Map<string, ParsedModule>();
  /** Per file: the last plain-JavaScript AST read for it, reused while its source is unchanged. */
  private readonly programs = new Map<string, { source: string; ast: Program }>();

  /** The entries of `dir`, or `null` when it can't be read. */
  listDirectory(dir: string): Dirent[] | null {
    return this.listings.entries(dir);
  }

  /** Whether `filePath` exists, from its directory's listing. */
  exists(filePath: string): boolean {
    return this.listings.has(dirname(filePath), basename(filePath));
  }

  /**
   * Resolves a module specifier to an on-disk source file.
   *
   * Tries the path verbatim, with each of {@link MODULE_EXTENSIONS}, then an
   * `index.*` file when the specifier points at a directory, and finally the
   * `.ts` file a missing `.js` specifier stands for. Only relative, absolute,
   * and tsconfig/jsconfig path-alias specifiers resolve; a bare package
   * specifier (`"helpers"`) never names a file next to the importer.
   *
   * @param fromDir - The importing file's directory.
   *
   * @example
   * ```ts
   * graph.resolve("./utils", "/abs/src") // "/abs/src/utils.ts"
   * ```
   */
  resolve(specifier: string, fromDir: string): string | null {
    const aliased = this.aliases.absolute(specifier, fromDir);
    if (aliased === specifier && !isPathSpecifier(specifier)) return null;
    const base = resolve(fromDir, aliased);
    const parentDir = dirname(base);
    const baseName = basename(base);

    if (this.listings.has(parentDir, baseName)) {
      // The cached listing already knows the entry's type; only a symlink,
      // whose target's type the listing doesn't record, or a name that
      // matched by case/normalization variant (not in the listing under this
      // exact name) still needs the `stat`.
      const entry = this.listings.entry(parentDir, baseName);
      const stat = entry && !entry.isSymbolicLink() ? entry : statSync(base, { throwIfNoEntry: false });
      if (stat?.isFile()) return base;

      for (const ext of MODULE_EXTENSIONS) {
        if (this.listings.has(parentDir, baseName + ext)) return base + ext;
      }

      if (stat?.isDirectory()) {
        for (const ext of MODULE_EXTENSIONS) {
          if (this.listings.has(base, `index${ext}`)) return join(base, `index${ext}`);
        }
      }
      return null;
    }

    for (const ext of MODULE_EXTENSIONS) {
      if (this.listings.has(parentDir, baseName + ext)) return base + ext;
    }

    return this.typeScriptCounterpart(base) ?? null;
  }

  /**
   * `filePath`'s text and top-level statements (see {@link parseModule}),
   * parsed once. Needs the parser stack loaded.
   */
  parse(filePath: string): ParsedModule {
    let parsed = this.modules.get(filePath);
    if (parsed === undefined) {
      parsed = parseModule(filePath);
      this.modules.set(filePath, parsed);
    }
    return parsed;
  }

  /**
   * `source` parsed as plain JavaScript, as a component barrel is read
   * (TypeScript syntax throws). Reused while `filePath`'s source is unchanged.
   */
  parseJavaScript(filePath: string, source: string): Program {
    const cached = this.programs.get(filePath);
    if (cached?.source === source) return cached.ast;
    const ast = parseJavaScript(source, { ecmaVersion: "latest", sourceType: "module" });
    this.programs.set(filePath, { source, ast });
    return ast;
  }

  /**
   * Forgets the parses of `filePaths`, and every directory listing: an edit
   * can add or remove files anywhere, so the next lookups re-read the
   * directories they probe. Watch mode calls this with each batch of
   * changed files.
   */
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
 * Parses a module file into its top-level statements, with byte offsets into
 * the file's own text for verbatim text extraction.
 *
 * A plain module goes straight to acorn with the TypeScript plugin (a `.js`
 * file is valid input too). A `.svelte` file yields its module script
 * (`<script module>` / `<script context="module">`), the only place a
 * component declares exports other than its default.
 */
function parseModule(filePath: string): ParsedModule {
  let text: string;
  try {
    text = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  try {
    let body: AstNode[];
    if (filePath.endsWith(".svelte")) {
      const ast = getParserStack().parseSvelte(text) as { module?: { content?: { body?: unknown } } };
      body = asNodeArray(ast.module?.content?.body);
    } else {
      body = asNodeArray(getParserStack().parseProgram(text, true, []).body);
    }
    return { source: { text, filePath, dir: dirname(filePath) }, body };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warn(`Warning: sveld couldn't parse ${filePath} to read its exports (${message}); skipping it.`);
    return null;
  }
}
