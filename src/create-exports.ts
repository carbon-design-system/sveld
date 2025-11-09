import type { ParsedExports } from "./parse-exports";

const SVELTE_EXT_REGEX = /\.svelte$/;

export function createExports(parsed_exports: ParsedExports): string {
  const source = Object.entries(parsed_exports).map(([id, exportee]) => {
    // Check if the source is a .svelte file (Svelte components are always default exports)
    const isSvelteFile = SVELTE_EXT_REGEX.test(exportee.source);

    // If id is "default", always export as default
    if (id === "default") {
      return `export { default } from "${exportee.source}";`;
    }

    // If exportee.default is true, OR if it's a Svelte component, we're re-exporting a default export with a new name
    if (exportee.default || isSvelteFile) {
      if (exportee.mixed) {
        return `export { default as ${id} } from "${exportee.source}";\nexport { default } from "${exportee.source}";`;
      }

      return `export { default as ${id} } from "${exportee.source}";`;
    }

    // Otherwise, it's a named export
    return `export { ${id} } from "${exportee.source}";`;
  });

  return source.join("\n");
}

export function removeSvelteExt(filePath: string): string {
  return filePath.replace(SVELTE_EXT_REGEX, "");
}

export function convertSvelteExt(filePath: string): string {
  return filePath.replace(SVELTE_EXT_REGEX, ".svelte.d.ts");
}
