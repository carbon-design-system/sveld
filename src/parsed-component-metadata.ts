/** Split out of `./ComponentParser` so readers of this field don't import the parser stack. */
import type { ParsedComponentTypeScriptMetadata } from "./model";

export const PARSED_COMPONENT_TYPE_SCRIPT_METADATA = Symbol("sveld.parsedComponentTypeScriptMetadata");

/**
 * `@sveld-ignore` codes from each prop's JSDoc, by prop name. Diagnostics
 * reported after parsing, like `extend-props-override`, read them here.
 */
export const PARSED_COMPONENT_PROP_IGNORES = Symbol("sveld.parsedComponentPropIgnores");

export function getParsedComponentPropIgnores(component: {
  [PARSED_COMPONENT_PROP_IGNORES]?: Record<string, string[]>;
}): Record<string, string[]> | undefined {
  return component[PARSED_COMPONENT_PROP_IGNORES];
}

export function getParsedComponentTypeScriptMetadata(component: {
  [PARSED_COMPONENT_TYPE_SCRIPT_METADATA]?: ParsedComponentTypeScriptMetadata;
}) {
  return component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA];
}
