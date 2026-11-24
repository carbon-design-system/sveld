/**
 * Split out of `./ComponentParser` so readers of this field don't import
 * the parser stack.
 */
import type { ParsedComponentTypeScriptMetadata } from "./model";

export const PARSED_COMPONENT_TYPE_SCRIPT_METADATA = Symbol("sveld.parsedComponentTypeScriptMetadata");

// Kept since diagnostics reported after parsing, like
// `extend-props-override`, read each prop's `@sveld-ignore` codes here.
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
