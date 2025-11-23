import type { ParsedExports } from "./parse-exports";

const SVELTE_EXT_REGEX = /\.svelte$/;

export function createExports(parsed_exports: ParsedExports): string {
  // Group exports by source file
  const groupedBySource = new Map<string, Array<{ id: string; exportee: ParsedExports[string] }>>();

  for (const [id, exportee] of Object.entries(parsed_exports)) {
    const existing = groupedBySource.get(exportee.source) || [];
    existing.push({ id, exportee });
    groupedBySource.set(exportee.source, existing);
  }

  // Generate export statements, keeping grouped exports together
  const exportStatements: string[] = [];

  for (const [source, exports] of groupedBySource) {
    const isSvelteFile = SVELTE_EXT_REGEX.test(source);

    // Check if this source has both default and non-default exports (indicates module context exports)
    // Exclude id="default" from this check, as that's just re-exporting the default as-is
    const hasDefaultExport = exports.some(({ id, exportee }) => id !== "default" && exportee.default);
    const hasNonDefaultExport = exports.some(({ exportee }) => !exportee.default);
    const hasMixedExports = isSvelteFile && hasDefaultExport && hasNonDefaultExport;

    // Separate named exports from default exports
    const namedExports: string[] = [];
    const defaultExports: string[] = [];
    const defaultAsExports: string[] = []; // Track "default as X" exports

    for (const { id, exportee } of exports) {
      // If id is "default", always export as default
      if (id === "default") {
        defaultExports.push(`export { default } from "${source}";`);
        continue;
      }

      // If exportee.default is true, we're re-exporting a default export with a new name
      if (exportee.default) {
        if (exportee.mixed) {
          defaultExports.push(`export { default as ${id} } from "${source}";`);
          defaultExports.push(`export { default } from "${source}";`);
        } else {
          // Use "default as X" so they can be grouped with named exports from same source
          defaultAsExports.push(`default as ${id}`);
        }
      } else if (isSvelteFile && !hasMixedExports) {
        // For Svelte files without mixed exports, treat as component (re-export default)
        defaultAsExports.push(`default as ${id}`);
      } else {
        // It's a named export (including named exports from Svelte module context)
        namedExports.push(id);
      }
    }

    // Combine default-as-renamed and named exports from same source (for Svelte module exports)
    if (defaultAsExports.length > 0 && namedExports.length > 0) {
      // Combine into single statement: export { default as X, namedExport } from "source"
      exportStatements.push(`export { ${[...defaultAsExports, ...namedExports].join(", ")} } from "${source}";`);
    } else {
      // Generate grouped named exports
      if (namedExports.length > 0) {
        exportStatements.push(`export { ${namedExports.join(", ")} } from "${source}";`);
      }

      // Add default-as exports
      if (defaultAsExports.length > 0) {
        exportStatements.push(`export { ${defaultAsExports.join(", ")} } from "${source}";`);
      }
    }

    // Add default exports (these cannot be grouped)
    exportStatements.push(...defaultExports);
  }

  return exportStatements.join("\n");
}

export function removeSvelteExt(filePath: string): string {
  return filePath.replace(SVELTE_EXT_REGEX, "");
}

export function convertSvelteExt(filePath: string): string {
  return filePath.replace(SVELTE_EXT_REGEX, ".svelte.d.ts");
}
