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

/** Drops `@ignore`/`@internal`-tagged entries. The raw, unfiltered list lives on `ParsedComponent`. */
function excludeInternal<T extends { internal?: boolean }>(items: T[]): T[] {
  return items.some((item) => item.internal) ? items.filter((item) => !item.internal) : items;
}

/**
 * Strips `@ignore`/`@internal` members from every list a component exposes, so no writer -
 * Markdown, JSON, `.d.ts`, custom elements, `llms.txt` - has to filter independently. The raw,
 * unfiltered `ParsedComponent` (props/events/slots/etc. still carrying `internal: true`) remains
 * available to callers that read the parser output directly, e.g. `sveld --check`.
 */
function excludeInternalMembers(component: ComponentDocApi): ComponentDocApi {
  return {
    ...component,
    props: excludeInternal(component.props),
    moduleExports: excludeInternal(component.moduleExports),
    slots: excludeInternal(component.slots),
    events: excludeInternal(component.events),
    typedefs: excludeInternal(component.typedefs),
    ...(component.contexts
      ? {
          contexts: excludeInternal(component.contexts).map((context) => ({
            ...context,
            properties: excludeInternal(context.properties),
          })),
        }
      : {}),
  };
}

/**
 * Builds the canonical document for a component collection: components
 * sorted alphabetically by `moduleName`, with the Node-only `diagnostics`
 * field stripped and `@ignore`/`@internal` members excluded.
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
    return excludeInternalMembers(rest as ComponentDocApi);
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

  const entryExports = options.entryExports ? excludeInternal(options.entryExports) : undefined;
  if (entryExports && entryExports.length > 0) {
    document.totalExports = entryExports.length;
    document.exports = entryExports;
  }

  if (!byEntryExports) {
    byEntryExports = new Map();
    documentCache.set(components, byEntryExports);
  }
  byEntryExports.set(options.entryExports, document);

  return document;
}
