import { version as svelteVersion } from "svelte/package.json";
import { name as packageName, version as packageVersion } from "../../package.json";
import type { EntryExports } from "../parse-entry-exports";
import type { ComponentDocApi, ComponentDocs } from "../plugin";

export const COMPONENT_API_SCHEMA_VERSION = 1;

/**
 * Canonical, renderer-agnostic representation of a component collection.
 *
 * Every writer (JSON, Markdown, TypeScript definitions) builds this document
 * via `buildComponentApiDocument` instead of independently sorting/filtering
 * the raw `ComponentDocs` map, so sort order and field stripping can't drift
 * between output formats.
 */
export interface ComponentApiDocument {
  schemaVersion: 1;
  generator: {
    name: string;
    version: string;
    svelteVersion: string;
  };
  total: number;
  components: ComponentDocApi[];
  /** Only when `documentExports` is on. */
  totalExports?: number;
  exports?: EntryExports;
}

export interface BuildComponentApiDocumentOptions {
  /** Entry-barrel exports when `documentExports` is on. */
  entryExports?: EntryExports;
}

/**
 * Builds the canonical document for a component collection: components
 * sorted alphabetically by `moduleName`, with the Node-only `diagnostics`
 * field stripped.
 */
export function buildComponentApiDocument(
  components: ComponentDocs,
  options: BuildComponentApiDocumentOptions = {},
): ComponentApiDocument {
  const sorted = Array.from(components, ([, component]) => {
    // `diagnostics` is for the Node API only; rendered output skips it.
    const { diagnostics: _diagnostics, ...rest } = component;
    return rest as ComponentDocApi;
  }).sort((a, b) => a.moduleName.localeCompare(b.moduleName));

  const document: ComponentApiDocument = {
    schemaVersion: COMPONENT_API_SCHEMA_VERSION,
    generator: {
      name: packageName,
      version: packageVersion,
      svelteVersion,
    },
    total: sorted.length,
    components: sorted,
  };

  if (options.entryExports && options.entryExports.length > 0) {
    document.totalExports = options.entryExports.length;
    document.exports = options.entryExports;
  }

  return document;
}
