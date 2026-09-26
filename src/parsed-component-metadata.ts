/**
 * Runtime helpers for `ParsedComponent`'s symbol-keyed TypeScript metadata,
 * split out of `./ComponentParser` so callers that only need to read or
 * write this field (`parse-cache.ts`, `writer/writer-ts-definitions-core.ts`,
 * `finalize-standalone.ts`) don't have to import the parser stack to get it.
 */
import type { ParsedComponentTypeScriptMetadata } from "./model";

export const PARSED_COMPONENT_TYPE_SCRIPT_METADATA = Symbol("sveld.parsedComponentTypeScriptMetadata");

export function getParsedComponentTypeScriptMetadata(component: {
  [PARSED_COMPONENT_TYPE_SCRIPT_METADATA]?: ParsedComponentTypeScriptMetadata;
}) {
  return component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA];
}
