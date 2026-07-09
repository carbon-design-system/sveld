import { name as packageName, version as packageVersion } from "../../package.json";
import type { EntryExports } from "../parse-entry-exports";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { VERSION as svelteVersion } from "../svelte-version";

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
 * Caches by `components` identity, then by `entryExports` identity, so that
 * `writeOutput()`'s json/markdown/custom-elements writers - which are
 * commonly called with the same `components` map and the same (or absent)
 * `entryExports` reference in one run - only pay the sort/strip cost once.
 * A fresh `components` map (new run, tests) is a fresh WeakMap entry, so
 * staleness across runs isn't possible.
 */
const documentCache = new WeakMap<ComponentDocs, Map<EntryExports | undefined, ComponentApiDocument>>();

/**
 * Builds the canonical document for a component collection: components
 * sorted alphabetically by `moduleName`, with the Node-only `diagnostics`
 * field stripped.
 */
export function buildComponentApiDocument(
  components: ComponentDocs,
  options: BuildComponentApiDocumentOptions = {},
): ComponentApiDocument {
  let byEntryExports = documentCache.get(components);
  const cached = byEntryExports?.get(options.entryExports);
  if (cached) return cached;

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

  if (!byEntryExports) {
    byEntryExports = new Map();
    documentCache.set(components, byEntryExports);
  }
  byEntryExports.set(options.entryExports, document);

  return document;
}
