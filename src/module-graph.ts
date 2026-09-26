import { readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { directoryEntry, directoryHasEntry, typeScriptCounterpart } from "./fs-listing";
import { warn } from "./logger";
import { getParserStack } from "./parser-stack";
import { resolvePathAliasAbsolute } from "./resolve-alias";

/** Extensions probed when resolving a bare module specifier to a file. */
const CANDIDATE_EXTENSIONS = [".ts", ".mts", ".cts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".d.ts"];

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
 * Resolves a module specifier to an on-disk source file.
 *
 * Tries the path verbatim, with each candidate extension, then an
 * `index.*` file when the specifier points at a directory, and finally the
 * `.ts` file a missing `.js` specifier stands for. Only relative, absolute,
 * and tsconfig/jsconfig path-alias specifiers resolve; a bare package
 * specifier (`"helpers"`) never names a file next to the importer.
 *
 * @example
 * ```ts
 * resolveModuleFile("./utils", "/abs/src") // "/abs/src/utils.ts"
 * ```
 */
export function resolveModuleFile(specifier: string, fromDir: string): string | null {
  const aliased = resolvePathAliasAbsolute(specifier, fromDir);
  if (aliased === specifier && !isPathSpecifier(specifier)) return null;
  const base = resolve(fromDir, aliased);
  const parentDir = dirname(base);
  const baseName = basename(base);

  if (directoryHasEntry(parentDir, baseName)) {
    // The cached listing already knows the entry's type; only a symlink,
    // whose target's type the listing doesn't record, or a name that
    // matched by case/normalization variant (not in the listing under this
    // exact name) still needs the `stat`.
    const entry = directoryEntry(parentDir, baseName);
    const stat = entry && !entry.isSymbolicLink() ? entry : statSync(base, { throwIfNoEntry: false });
    if (stat?.isFile()) return base;

    for (const ext of CANDIDATE_EXTENSIONS) {
      if (directoryHasEntry(parentDir, baseName + ext)) return base + ext;
    }

    if (stat?.isDirectory()) {
      for (const ext of CANDIDATE_EXTENSIONS) {
        if (directoryHasEntry(base, `index${ext}`)) return join(base, `index${ext}`);
      }
    }
    return null;
  }

  for (const ext of CANDIDATE_EXTENSIONS) {
    if (directoryHasEntry(parentDir, baseName + ext)) return base + ext;
  }

  return typeScriptCounterpart(base) ?? null;
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
export function parseModule(filePath: string): ParsedModule {
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
