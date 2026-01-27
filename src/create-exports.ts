import type { ParsedExports } from "./parse-exports";

const SVELTE_EXT_REGEX = /\.svelte$/;

/**
 * Creates export statements from parsed export information.
 *
 * Groups exports by source file and generates optimized export statements.
 * Handles special cases like Svelte component exports, default exports,
 * and mixed exports from module context.
 *
 * @param parsed_exports - Map of export names to their source and metadata
 * @returns A string containing all export statements
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
  /**
   * Group exports by source file.
   * This allows us to combine multiple exports from the same source
   * into a single export statement for better organization.
   */
  const groupedBySource = new Map<string, Array<{ id: string; exportee: ParsedExports[string] }>>();

  for (const [id, exportee] of Object.entries(parsed_exports)) {
    const existing = groupedBySource.get(exportee.source) || [];
    existing.push({ id, exportee });
    groupedBySource.set(exportee.source, existing);
  }

  /**
   * Generate export statements, keeping grouped exports together.
   * Exports from the same source file are combined into single statements
   * when possible for cleaner output.
   */
  const exportStatements: string[] = [];

  for (const [source, exports] of groupedBySource) {
    const isSvelteFile = SVELTE_EXT_REGEX.test(source);

    /**
     * Check if this source has both default and non-default exports (indicates module context exports).
     * Exclude id="default" from this check, as that's just re-exporting the default as-is.
     * Mixed exports occur when a Svelte file has both `<script context="module">` exports
     * and a default component export.
     */
    const hasDefaultExport = exports.some(({ id, exportee }) => id !== "default" && exportee.default);
    const hasNonDefaultExport = exports.some(({ exportee }) => !exportee.default);
    const hasMixedExports = isSvelteFile && hasDefaultExport && hasNonDefaultExport;

    /**
     * Separate named exports from default exports.
     * Also track "default as X" exports separately as they can be combined with named exports.
     */
    const namedExports: string[] = [];
    const defaultExports: string[] = [];
    /**
     * Track "default as X" exports separately.
     * These can be grouped with named exports from the same source.
     */
    const defaultAsExports: string[] = [];

    for (const { id, exportee } of exports) {
      /**
       * If id is "default", always export as default.
       * This handles explicit default re-exports.
       */
      if (id === "default") {
        defaultExports.push(`export { default } from "${source}";`);
        continue;
      }

      /**
       * If exportee.default is true, we're re-exporting a default export with a new name.
       * Handle mixed exports specially (both default and named from module context).
       */
      if (exportee.default) {
        if (exportee.mixed) {
          defaultExports.push(`export { default as ${id} } from "${source}";`);
          defaultExports.push(`export { default } from "${source}";`);
        } else {
          /**
           * Use "default as X" so they can be grouped with named exports from same source.
           * This allows combining default-as-renamed with named exports in one statement.
           */
          defaultAsExports.push(`default as ${id}`);
        }
      } else if (isSvelteFile && !hasMixedExports) {
        /**
         * For Svelte files without mixed exports, treat as component (re-export default).
         * Svelte components are default exports, so we re-export them as named exports.
         */
        defaultAsExports.push(`default as ${id}`);
      } else {
        /**
         * It's a named export (including named exports from Svelte module context).
         * These come from `<script context="module">` blocks.
         */
        namedExports.push(id);
      }
    }

    /**
     * Combine default-as-renamed and named exports from same source (for Svelte module exports).
     * This creates statements like: `export { default as Component, namedExport } from "source"`
     */
    if (defaultAsExports.length > 0 && namedExports.length > 0) {
      /**
       * Combine into single statement: export { default as X, namedExport } from "source".
       * This is more efficient and cleaner than separate statements.
       */
      exportStatements.push(`export { ${[...defaultAsExports, ...namedExports].join(", ")} } from "${source}";`);
    } else {
      /**
       * Generate grouped named exports.
       * Multiple named exports from the same source are combined.
       */
      if (namedExports.length > 0) {
        exportStatements.push(`export { ${namedExports.join(", ")} } from "${source}";`);
      }

      /**
       * Add default-as exports.
       * These are component re-exports: `export { default as ComponentName } from "source"`.
       */
      if (defaultAsExports.length > 0) {
        exportStatements.push(`export { ${defaultAsExports.join(", ")} } from "${source}";`);
      }
    }

    /**
     * Add default exports (these cannot be grouped).
     * Default exports must be in separate statements as they can't be combined
     * with named exports in the same statement.
     */
    exportStatements.push(...defaultExports);
  }

  return exportStatements.join("\n");
}

/**
 * Removes the `.svelte` extension from a file path.
 *
 * @param filePath - The file path to process
 * @returns The path without the .svelte extension
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
 * Converts a `.svelte` file path to a `.svelte.d.ts` TypeScript definition path.
 *
 * @param filePath - The Svelte file path to convert
 * @returns The path with .svelte.d.ts extension
 *
 * @example
 * ```ts
 * convertSvelteExt("./Button.svelte") // Returns: "./Button.svelte.d.ts"
 * ```
 */
export function convertSvelteExt(filePath: string): string {
  return filePath.replace(SVELTE_EXT_REGEX, ".svelte.d.ts");
}
