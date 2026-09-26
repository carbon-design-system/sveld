import { dirname, relative, resolve } from "node:path";
import { createDiagnostic, type SveldDiagnostic } from "./diagnostics";
import type { DeprecatedValue, JsDocPassthroughTag } from "./model";
import { collectModuleExports, createResolveContext } from "./module-exports";
import { ModuleGraph } from "./module-graph";
import { compareText } from "./parser/utils";
import { loadParserStack } from "./parser-stack";
import { normalizeSeparators } from "./path";

/** One named export from the entry barrel (not a `.svelte` component). */
export interface EntryExport {
  name: string;
  kind: "const" | "let" | "var" | "function" | "class" | "type" | "interface" | "enum";
  /**
   * Type text from the source, when present. A namespace export
   * (`export * as ns from "./x"`) gets `typeof import("./x.ts")`, the
   * wrapped module relative to the entry file.
   */
  type?: string;
  /** Initializer text for simple constants. */
  value?: string;
  description?: string;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** `@since` / `@example` / `@see` tags in source order. */
  tags?: JsDocPassthroughTag[];
  /** True from `@ignore`/`@internal` JSDoc; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
  /** Declaring module, relative to the entry file. */
  source?: string;
  isTypeOnly: boolean;
}

export type EntryExports = EntryExport[];

export interface ParseEntryExportsOptions {
  /**
   * Receives an `export-ambiguous` diagnostic for each name two of the
   * entry's `export *` statements bring in from different modules.
   */
  diagnostics?: SveldDiagnostic[];
  /** Resolves and parses the modules the barrel re-exports from; a fresh one by default. */
  graph?: ModuleGraph;
}

/**
 * List consts, functions, and types exported from an entry barrel.
 *
 * Follows re-exports with AST-only traversal. Skips `.svelte` files.
 *
 * @param entryFile - Absolute path to the entry module.
 * @param options - Where to record diagnostics about the barrel.
 * @returns Exports deduplicated by name, sorted alphabetically.
 *
 * @example
 * ```ts
 * // entry: export { VERSION } from "./constants"; export type { Theme } from "./types";
 * await parseEntryExports("/abs/src/index.ts");
 * // [{ name: "Theme", kind: "type", isTypeOnly: true, ... }, { name: "VERSION", kind: "const", ... }]
 * ```
 */
export async function parseEntryExports(
  entryFile: string,
  options: ParseEntryExportsOptions = {},
): Promise<EntryExports> {
  await loadParserStack();

  const resolved = resolve(entryFile);
  const entryDir = dirname(resolved);
  const relativeSource = (declFile: string) => normalizeSeparators(`./${relative(entryDir, declFile)}`);

  // `collectModuleExports` already drops an ambiguous `export *` name; report
  // the entry's own, since the author likely meant to export it. A nested
  // barrel's was never one of the entry's exports.
  const collected = collectModuleExports(resolved, {
    ...createResolveContext(options.graph ?? new ModuleGraph()),
    onAmbiguousStarExport: (filePath, name, entries) => {
      if (filePath !== resolved || !options.diagnostics) return;
      // Components get their own docs, from `parse-exports.ts`.
      if (entries.every((entry) => entry.declFile.endsWith(".svelte"))) return;
      const sources = Array.from(new Set(entries.map((entry) => relativeSource(entry.declFile))));
      const quoted = sources.map((source) => `"${source}"`);
      const listed = `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
      options.diagnostics.push(
        createDiagnostic({
          component: relativeSource(resolved),
          kind: "export-ambiguous",
          name,
          message: `"${name}" is exported by ${listed} through \`export *\`, so the barrel doesn't export it and the docs leave it out; export it explicitly from the barrel (e.g. \`export { ${name} } from "${sources[0]}"\`).`,
        }),
      );
    },
  });

  const byName = new Map<string, EntryExport>();
  // Entries sharing a name are one declaration's overloads; the last (the
  // implementation signature) wins.
  for (const entry of collected) {
    // The barrel's default export isn't a named export, and components get
    // their own docs.
    if (entry.name === "default" || entry.declFile.endsWith(".svelte")) continue;
    // Drop the fields public `EntryExport` doesn't expose.
    const {
      declFile,
      returnType: _returnType,
      literalValue: _literalValue,
      primitiveLiteral: _primitiveLiteral,
      declaredType: _declaredType,
      functionNode: _functionNode,
      namespaceFile,
      ...rest
    } = entry;
    const source = relativeSource(declFile);
    // A namespace export has no declaration to copy type text from; name the
    // module it wraps, as component docs do for a module-script re-export.
    // `kind` stays "const": the binding is a const namespace object.
    if (namespaceFile !== undefined) rest.type = `typeof import(${JSON.stringify(relativeSource(namespaceFile))})`;
    byName.set(entry.name, { ...rest, source });
  }

  return Array.from(byName.values()).sort((a, b) => compareText(a.name, b.name));
}
