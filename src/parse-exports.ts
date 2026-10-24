import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Identifier, StringLiteral } from "sveast";
import { asRelativeSourcePath, type RelativeSourcePath } from "./brands";
import { ModuleGraph } from "./module-graph";
import { normalizeSeparators, SVELTE_EXT_REGEX } from "./path";
import { UnresolvedModuleError } from "./resolve-alias";

export type ParsedExports = Record<
  string,
  {
    source: RelativeSourcePath;
    default: boolean;
    mixed?: boolean;
    /**
     * An `export * from` the barrel keeps as written: its target brought no
     * exports sveld reads, so it is a types-only module, a `.d.ts` next to an
     * empty `.js`, that TypeScript resolves on its own. Keyed `*:<source>`.
     */
    star?: true;
  }
>;

/** An export or import name: `x`, or the string in `export { "x-y" as z }`. */
function moduleExportName(node: Identifier | StringLiteral): string {
  return node.type === "Identifier" ? node.name : node.value;
}

/**
 * Parses the exports of the module a non-`.svelte` re-export
 * (`export { X } from "./barrel"`) resolves to. `null` when it resolves to no
 * file, so callers warn. Empty (callers record the literal specifier) on an
 * import cycle or when the module isn't plain JS, e.g. TypeScript-only.
 */
function resolveBarrelExports(
  graph: ModuleGraph,
  specifier: string,
  fromDir: string,
  resolving: Set<string>,
): { dir: string; exports: ParsedExports } | null {
  const targetFile = graph.resolve(specifier, fromDir);
  if (!targetFile) return null;

  const dir = dirname(targetFile);
  if (resolving.has(targetFile)) return { dir, exports: {} };

  resolving.add(targetFile);
  try {
    return { dir, exports: readExports(graph, readFileSync(targetFile, "utf-8"), dir, resolving, targetFile) };
  } catch {
    return { dir, exports: {} };
  } finally {
    resolving.delete(targetFile);
  }
}

/**
 * Parses an entry file's exports, resolving aliases against `dir`.
 *
 * @param resolving - Absolute paths not to follow `export *` into, e.g. the
 *   entry itself so a self-re-exporting barrel stops there.
 * @param fromFile - The entry file, named when an `export *` can't be resolved.
 */
export function parseExports(
  source: string,
  dir: string,
  graph: ModuleGraph = new ModuleGraph(),
  resolving: Set<string> = new Set(),
  fromFile = dir,
): ParsedExports {
  return readExports(graph, source, dir, resolving, fromFile);
}

/**
 * @param resolving - Paths on the current call stack, breaking `export *` cycles.
 * @param fromFile - Named in a thrown {@link UnresolvedModuleError}.
 */
function readExports(
  graph: ModuleGraph,
  source: string,
  dir: string,
  resolving: Set<string>,
  fromFile: string,
): ParsedExports {
  const ast = graph.parseJavaScript(fromFile, source);

  const exports_by_identifier: ParsedExports = {};

  for (const node of ast.body) {
    if (node.type === "ExportDefaultDeclaration") {
      // `export default Button`; an anonymous default isn't a component.
      if (node.declaration.type !== "Identifier") continue;
      const id = node.declaration.name;

      if (id in exports_by_identifier) {
        exports_by_identifier[id].default = true;
      } else {
        exports_by_identifier[id] = { source: asRelativeSourcePath(""), default: true };
      }
    } else if (node.type === "ExportAllDeclaration") {
      const specifier = node.source.value;

      const file_path = graph.resolve(specifier, dir);

      if (!file_path) {
        const lookup = graph.aliases.lookup(specifier, dir);
        throw new UnresolvedModuleError(
          specifier,
          fromFile,
          lookup.unresolved ? lookup.searched : "no matching file or index found",
        );
      }

      if (resolving.has(file_path)) continue;
      resolving.add(file_path);

      const export_file = readFileSync(file_path, "utf-8");
      const exports = readExports(graph, export_file, dirname(file_path), resolving, file_path);

      resolving.delete(file_path);

      const entries = Object.entries(exports);
      // Nothing sveld reads came through: a types-only module, declared in a
      // `.d.ts` beside an empty `.js`. The `.d.ts` barrel keeps the statement
      // as written, so TypeScript re-exports the types.
      if (entries.length === 0 && !SVELTE_EXT_REGEX.test(specifier)) {
        const source = asRelativeSourcePath(normalizeSeparators(specifier));
        exports_by_identifier[`*:${specifier}`] = { source, default: false, star: true };
      }
      for (const [key, value] of entries) {
        // A relative source is relative to the re-exported file's directory,
        // which is the specifier itself only when it names a directory.
        const source = asRelativeSourcePath(
          normalizeSeparators(
            value.source.startsWith(".")
              ? `./${relative(dir, resolve(dirname(file_path), value.source))}`
              : `./${join(specifier, value.source)}`,
          ),
        );
        exports_by_identifier[key] = { ...value, source };
      }
    } else if (node.type === "ExportNamedDeclaration") {
      const sourceValue = node.source?.value;
      const isSvelteSource = sourceValue !== undefined && SVELTE_EXT_REGEX.test(sourceValue);

      if (isSvelteSource) {
        const lookup = graph.aliases.lookup(sourceValue, dir);
        if (lookup.unresolved) {
          throw new UnresolvedModuleError(sourceValue, fromFile, lookup.searched);
        }
      }

      const isBarrelChain = sourceValue !== undefined && !isSvelteSource;
      const chain = isBarrelChain ? resolveBarrelExports(graph, sourceValue, dir, resolving) : undefined;

      if (chain === null) {
        console.warn(
          `sveld: could not resolve re-exported module "${sourceValue}" from barrel "${dir || "."}"; skipping.`,
        );
        continue;
      }

      for (const specifier of node.specifiers) {
        const exported_name = moduleExportName(specifier.exported);
        const local_name = moduleExportName(specifier.local);
        const id = exported_name || local_name;
        const chained = chain?.exports[local_name];
        const source: RelativeSourcePath = chained
          ? asRelativeSourcePath(normalizeSeparators(`./${relative(dir, resolve(chain.dir, chained.source))}`))
          : asRelativeSourcePath(graph.aliases.relative(sourceValue ?? "", dir));
        const isDefault = chained ? chained.default : local_name === "default";

        if (id in exports_by_identifier) {
          exports_by_identifier[id].mixed = true;

          if (!exports_by_identifier[id].source) {
            exports_by_identifier[id].source = source;
          }
        } else {
          exports_by_identifier[id] = { source, default: isDefault };
        }
      }
    } else if (node.type === "ImportDeclaration") {
      // `import "./styles.css"` binds nothing.
      const first = node.specifiers[0];
      if (!first) continue;
      const id = first.local.name;
      const source = asRelativeSourcePath(graph.aliases.relative(node.source.value, dir));

      if (id in exports_by_identifier) {
        if (!exports_by_identifier[id].source) exports_by_identifier[id].source = source;
      } else {
        exports_by_identifier[id] = { source, default: id === "default" };
      }
    }
  }

  return exports_by_identifier;
}
