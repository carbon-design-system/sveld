import { name as packageName, version as packageVersion } from "../../package.json";
import type { EntryExports } from "../parse-entry-exports";
import { compareText } from "../parser/utils";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { VERSION as svelteVersion } from "../svelte-version";

export const COMPONENT_API_SCHEMA_VERSION = 1;

/**
 * Canonical, renderer-agnostic representation of a component collection. Every
 * writer builds it via `buildComponentApiDocument`, so sort order and field
 * stripping can't drift between output formats.
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

function excludeInternal<T extends { internal?: boolean }>(items: T[]): T[] {
  return items.some((item) => item.internal) ? items.filter((item) => !item.internal) : items;
}

/** Done once here so no writer filters independently; `sveld --check` still sees the raw `ParsedComponent`. */
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
  const sorted = Array.from(components.values(), (component) => {
    // `diagnostics` is for the Node API only.
    const { diagnostics: _diagnostics, ...rest } = component;
    return excludeInternalMembers(rest);
  }).sort((a, b) => compareText(a.moduleName, b.moduleName));

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

  return document;
}
