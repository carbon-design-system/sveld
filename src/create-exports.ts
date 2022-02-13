import { ParsedExports } from "./parse-exports";
import { ComponentDocs } from "./rollup-plugin";

export function createExports(parsed_exports: ParsedExports, components: ComponentDocs): string {
  const source = Object.entries(parsed_exports).map(([id, exportee]) => {
    let module_exports: string[] = [];
    if (components.has(id)) {
      module_exports = components.get(id)!.moduleExports.map((moduleExport) => {
        return moduleExport.name;
      });
    }

    let named_exports = "";

    if (module_exports.length > 0) named_exports = ", " + module_exports.join(", ");

    if (id === "default" || exportee.default) {
      if (exportee.mixed) {
        return `export { default as ${id}${named_exports} } from "${exportee.source}";\nexport { default } from "${exportee.source}";`;
      }

      return `export { default${named_exports} } from "${exportee.source}";`;
    }

    return `export { default as ${id}${named_exports} } from "${exportee.source}";`;
  });

  return source.join("\n");
}

export function removeSvelteExt(filePath: string): string {
  return filePath.replace(/\.svelte$/, "");
}

export function convertSvelteExt(filePath: string): string {
  return filePath.replace(/\.svelte$/, ".svelte.d.ts");
}
