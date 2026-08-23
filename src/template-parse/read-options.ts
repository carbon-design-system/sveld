import type { AST } from "svelte/compiler";

/**
 * From svelte's `read/options.js`, but only `runes` and `customElement.tag`.
 * Those are the two `<svelte:options>` fields `src/parser/runes-props.ts` reads.
 * Doesn't validate reserved tag names or malformed objects. The shim test
 * drops any field this doesn't populate.
 */
export function readOptions(node: { start: number; end: number; attributes: AST.Attribute[] }): AST.SvelteOptions {
  const options: AST.SvelteOptions = {
    start: node.start,
    end: node.end,
    attributes: node.attributes,
  };

  for (const attribute of node.attributes) {
    if (attribute.type !== "Attribute") continue;

    if (attribute.name === "runes") {
      const value = getStaticValue(attribute);
      if (typeof value === "boolean") options.runes = value;
    }

    if (attribute.name === "customElement") {
      const tag = getCustomElementTag(attribute);
      if (tag !== undefined) options.customElement = { tag };
    }
  }

  return options;
}

function getStaticValue(attribute: AST.Attribute): unknown {
  const { value } = attribute;
  if (value === true) return true;

  const chunk = Array.isArray(value) ? value[0] : value;
  if (!chunk) return true;
  if (Array.isArray(value) && value.length > 1) return null;
  if (chunk.type === "Text") return chunk.data;
  if (chunk.expression.type !== "Literal") return null;
  return chunk.expression.value;
}

function getCustomElementTag(attribute: AST.Attribute): string | undefined {
  const { value } = attribute;
  if (value === true) return undefined;

  const chunk = Array.isArray(value) ? value[0] : value;
  if (!chunk) return undefined;

  // `customElement="my-el"` shorthand.
  if (chunk.type === "Text") {
    const tag = getStaticValue(attribute);
    return typeof tag === "string" ? tag : undefined;
  }

  // `customElement={{ tag: 'my-el', ... }}`. Only `tag` is extracted.
  if (chunk.expression.type === "ObjectExpression") {
    for (const property of chunk.expression.properties) {
      if (
        property.type === "Property" &&
        !property.computed &&
        property.key.type === "Identifier" &&
        property.key.name === "tag" &&
        property.value.type === "Literal" &&
        typeof property.value.value === "string"
      ) {
        return property.value.value;
      }
    }
  }

  return undefined;
}
