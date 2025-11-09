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

    // Separate named exports from default exports
    const namedExports: string[] = [];
    const defaultExports: string[] = [];

    for (const { id, exportee } of exports) {
      // If id is "default", always export as default
      if (id === "default") {
        defaultExports.push(`export { default } from "${source}";`);
        continue;
      }

      // If exportee.default is true, OR if it's a Svelte component, we're re-exporting a default export with a new name
      if (exportee.default || isSvelteFile) {
        if (exportee.mixed) {
          defaultExports.push(`export { default as ${id} } from "${source}";`);
          defaultExports.push(`export { default } from "${source}";`);
        } else {
          defaultExports.push(`export { default as ${id} } from "${source}";`);
        }
      } else {
        // It's a named export
        namedExports.push(id);
      }
    }

    // Generate grouped named exports
    if (namedExports.length > 0) {
      exportStatements.push(`export { ${namedExports.join(", ")} } from "${source}";`);
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
