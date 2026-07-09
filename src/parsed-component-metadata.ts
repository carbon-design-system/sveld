/**
 * Runtime helpers for `ParsedComponent`'s symbol-keyed TypeScript metadata,
 * split out of `./ComponentParser` so callers that only need to read or
 * write this field (`parse-cache.ts`, `writer/writer-ts-definitions-core.ts`,
 * `bundle.ts`) don't have to import the parser stack to get it.
 */
import type { ParsedComponent, ParsedComponentTypeScriptMetadata, ResolvedComponentProp } from "./ComponentParser";

export const PARSED_COMPONENT_TYPE_SCRIPT_METADATA = Symbol("sveld.parsedComponentTypeScriptMetadata");

export function getParsedComponentTypeScriptMetadata(component: {
  [PARSED_COMPONENT_TYPE_SCRIPT_METADATA]?: ParsedComponentTypeScriptMetadata;
}) {
  return component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA];
}

/** Append checker-resolved props. Names the AST walker already found are left alone. */
export function applyResolvedProps(component: ParsedComponent, resolved: ResolvedComponentProp[]): void {
  if (resolved.length === 0) return;

  const existing = new Set(component.props.map((prop) => prop.name));

  for (const prop of resolved) {
    if (existing.has(prop.name)) continue;
    existing.add(prop.name);

    component.props.push({
      name: prop.name,
      kind: "let",
      constant: false,
      type: prop.type,
      typeSource: "typescript",
      ...(prop.description ? { description: prop.description } : {}),
      isFunction: prop.type.includes("=>"),
      isFunctionDeclaration: false,
      isRequired: prop.isRequired,
      reactive: false,
    });
  }
}
