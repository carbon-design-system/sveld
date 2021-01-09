import { ParsedExports } from "./parse-exports";

export function createExports(parsed_exports: ParsedExports): string {
  const source = Object.entries(parsed_exports).map(([id, exportee]) => {
    if (id === "default" || exportee.default) {
      return `export { default } from "${exportee.source}";`;
    }

    return `export { default as ${id} } from "${exportee.source}";`;
  });

  return source.join("\n");
}
