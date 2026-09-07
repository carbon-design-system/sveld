import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { type Node, parse } from "acorn";
import { asRelativeSourcePath, type RelativeSourcePath } from "./brands";
import { resolveModuleFile } from "./parse-entry-exports";
import { normalizeSeparators, SVELTE_EXT_REGEX } from "./path";
import { resolveAliasLookup, resolvePathAlias, UnresolvedModuleError } from "./resolve-alias";

interface NodeImportDeclaration extends Node {
  type: "ImportDeclaration";
  specifiers: { local: { name: string } }[];
  source: null | { value: string };
}

interface NodeExportNamedDeclaration extends Node, Pick<NodeImportDeclaration, "source"> {
  type: "ExportNamedDeclaration";
  specifiers: { local: { name: string }; exported: { name: string } }[];
}

interface NodeExportDefaultDeclaration extends Node {
  type: "ExportDefaultDeclaration";
  declaration: { name: string };
}

interface NodeExportAllDeclaration extends Node, Pick<NodeImportDeclaration, "source"> {
  type: "ExportAllDeclaration";
}

type BodyNode =
  | NodeImportDeclaration
  | NodeExportNamedDeclaration
  | NodeExportDefaultDeclaration
  | NodeExportAllDeclaration;

export type ParsedExports = Record<
  string,
  {
    source: RelativeSourcePath;
    default: boolean;
    mixed?: boolean;
  }
>;

interface ProgramNode extends Node {
  type: "Program";
  body: BodyNode[];
}

const astCache = new Map<string, ProgramNode>();

function parseProgram(source: string): ProgramNode {
  return parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as ProgramNode;
}

/**
 * Follows a re-export specifier that does not point directly at a `.svelte`
 * file (e.g. `export { X } from "./barrel"`) to the module it resolves to,
 * and parses that module's own exports.
 *
 * Returns `null` when the specifier cannot be resolved to a file at all, so
 * callers can warn instead of recording a dangling source path. Returns an
 * empty map (not `null`) when the target participates in an import cycle
 * (mirroring the silent `export *` cycle guard below) or when it can't be
 * parsed as plain JS (e.g. a TypeScript-only `documentExports` data module),
 * so callers fall back to recording the literal specifier instead.
 */
function resolveBarrelExports(
  specifier: string,
  fromDir: string,
  resolving: Set<string>,
): { dir: string; exports: ParsedExports } | null {
  const targetFile = resolveModuleFile(specifier, fromDir);
  if (!targetFile) return null;

  const dir = dirname(targetFile);
  if (resolving.has(targetFile)) return { dir, exports: {} };

  resolving.add(targetFile);
  try {
    return { dir, exports: parseExports(readFileSync(targetFile, "utf-8"), dir, resolving, targetFile) };
  } catch {
    return { dir, exports: {} };
  } finally {
    resolving.delete(targetFile);
  }
}

/**
 * Parses exports from an entry file and resolves aliases against `dir`.
 *
 * @example
 * ```ts
 * // Source: export { Button } from "./Button.svelte";
 * //        export default App from "./App.svelte";
 * parseExports(source, "./src")
 * // Returns: {
 * //   Button: { source: "./Button.svelte", default: false },
 * //   App: { source: "./App.svelte", default: true }
 * // }
 * ```
 *
 * @param resolving - Absolute paths currently being resolved on this call
 *   stack, used to break `export *` cycles between files that re-export
 *   each other. Callers should not pass this; it is threaded internally.
 * @param fromFile - The file currently being parsed, used only to name the
 *   source of an unresolved specifier in a thrown {@link UnresolvedModuleError}.
 *   Callers should not pass this; it is threaded internally.
 */
export function parseExports(source: string, dir: string, resolving: Set<string> = new Set(), fromFile: string = dir) {
  let ast = astCache.get(source);

  if (!ast) {
    ast = parseProgram(source);
    astCache.set(source, ast);
  }

  const exports_by_identifier: ParsedExports = {};

  for (const node of ast.body) {
    if (node.type === "ExportDefaultDeclaration") {
      const id = node.declaration.name;

      if (id in exports_by_identifier) {
        exports_by_identifier[id].default = true;
      } else {
        exports_by_identifier[id] = { source: asRelativeSourcePath(""), default: true };
      }
    } else if (node.type === "ExportAllDeclaration") {
      if (!node.source) continue;

      const specifier = node.source.value;
      const file_path = resolveModuleFile(specifier, dir);

      if (!file_path) {
        const lookup = resolveAliasLookup(specifier, dir);
        throw new UnresolvedModuleError(
          specifier,
          fromFile,
          lookup.unresolved ? lookup.searched : "no matching file or index found",
        );
      }

      if (resolving.has(file_path)) continue;
      resolving.add(file_path);

      const export_file = readFileSync(file_path, "utf-8");
      const exports = parseExports(export_file, dirname(file_path), resolving, file_path);

      resolving.delete(file_path);

      for (const [key, value] of Object.entries(exports)) {
        const source = asRelativeSourcePath(normalizeSeparators(`./${join(specifier, value.source)}`));
        exports_by_identifier[key] = {
          ...value,
          source,
        };
      }
    } else if (node.type === "ExportNamedDeclaration") {
      const sourceValue = node.source?.value;
      const isSvelteSource = sourceValue !== undefined && SVELTE_EXT_REGEX.test(sourceValue);

      if (isSvelteSource) {
        const lookup = resolveAliasLookup(sourceValue, dir);
        if (lookup.unresolved) {
          throw new UnresolvedModuleError(sourceValue, fromFile, lookup.searched);
        }
      }

      const isBarrelChain = sourceValue !== undefined && !isSvelteSource;
      const chain = isBarrelChain ? resolveBarrelExports(sourceValue, dir, resolving) : undefined;

      if (chain === null) {
        console.warn(
          `sveld: could not resolve re-exported module "${sourceValue}" from barrel "${dir || "."}"; skipping.`,
        );
      }

      for (const specifier of node.specifiers) {
        const exported_name = specifier.exported.name;
        const local_name = specifier.local.name;
        const id = exported_name || local_name;

        if (chain === null) continue;

        const chained = chain?.exports[local_name];
        const source: RelativeSourcePath = chained
          ? asRelativeSourcePath(normalizeSeparators(`./${relative(dir, resolve(chain.dir, chained.source))}`))
          : asRelativeSourcePath(resolvePathAlias(sourceValue ?? "", dir));
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
      const id = node.specifiers[0].local.name;

      if (id in exports_by_identifier) {
        if (!exports_by_identifier[id].source) {
          exports_by_identifier[id].source = asRelativeSourcePath(resolvePathAlias(node.source?.value ?? "", dir));
        }
      } else {
        exports_by_identifier[id] = {
          source: asRelativeSourcePath(resolvePathAlias(node.source?.value ?? "", dir)),
          default: id === "default",
        };
      }
    }
  }

  return exports_by_identifier;
}
