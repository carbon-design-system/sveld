import type { ParsedExports } from "./parse-exports";

const SVELTE_EXT_REGEX = /\.svelte$/;

/**
 * Builds export statements from parsed export metadata.
 *
 * @example
 * ```ts
 * // Input:
 * { Button: { source: "./Button.svelte", default: true } }
 *
 * // Output:
 * // export { default as Button } from "./Button.svelte";
 * ```
 */
export function createExports(parsed_exports: ParsedExports): string {
  const groupedBySource = new Map<string, Array<{ id: string; exportee: ParsedExports[string] }>>();

  for (const [id, exportee] of Object.entries(parsed_exports)) {
    const existing = groupedBySource.get(exportee.source) || [];
    existing.push({ id, exportee });
    groupedBySource.set(exportee.source, existing);
  }

  const exportStatements: string[] = [];

  for (const [source, exports] of groupedBySource) {
    const isSvelteFile = SVELTE_EXT_REGEX.test(source);

    // `<script context="module">` exports plus the default component export.
    // Ignore id "default" here; that is an explicit default re-export.
    const hasDefaultExport = exports.some(({ id, exportee }) => id !== "default" && exportee.default);
    const hasNonDefaultExport = exports.some(({ exportee }) => !exportee.default);
    const hasMixedExports = isSvelteFile && hasDefaultExport && hasNonDefaultExport;

    const namedExports: string[] = [];
    const defaultExports: string[] = [];
    const defaultAsExports: string[] = [];

    for (const { id, exportee } of exports) {
      // Explicit `export { default } from "..."` re-export.
      if (id === "default") {
        defaultExports.push(`export { default } from "${source}";`);
        continue;
      }

      if (exportee.default) {
        if (exportee.mixed) {
          defaultExports.push(`export { default as ${id} } from "${source}";`);
          defaultExports.push(`export { default } from "${source}";`);
        } else {
          defaultAsExports.push(`default as ${id}`);
        }
      } else if (isSvelteFile && !hasMixedExports) {
        defaultAsExports.push(`default as ${id}`);
      } else {
        namedExports.push(id);
      }
    }

    if (defaultAsExports.length > 0 && namedExports.length > 0) {
      exportStatements.push(`export { ${[...defaultAsExports, ...namedExports].join(", ")} } from "${source}";`);
    } else {
      if (namedExports.length > 0) {
        exportStatements.push(`export { ${namedExports.join(", ")} } from "${source}";`);
      }

      if (defaultAsExports.length > 0) {
        exportStatements.push(`export { ${defaultAsExports.join(", ")} } from "${source}";`);
      }
    }

    // Default exports cannot share a statement with named exports.
    exportStatements.push(...defaultExports);
  }

  return exportStatements.join("\n");
}

/**
 * Strips the `.svelte` extension from a path.
 *
 * @example
 * ```ts
 * removeSvelteExt("./Button.svelte") // Returns: "./Button"
 * ```
 */
export function removeSvelteExt(filePath: string): string {
  return filePath.replace(SVELTE_EXT_REGEX, "");
}

/**
 * Maps a `.svelte` path to its `.svelte.d.ts` definition path.
 *
 * @example
 * ```ts
 * convertSvelteExt("./Button.svelte") // Returns: "./Button.svelte.d.ts"
 * ```
 */
export function convertSvelteExt(filePath: string): string {
  return filePath.replace(SVELTE_EXT_REGEX, ".svelte.d.ts");
}
