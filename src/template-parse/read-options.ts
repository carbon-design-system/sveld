import type { AST } from "svelte/compiler";

/**
 * From svelte's `read/options.js`, but only `runes` and `customElement`
 * (both the `tag` shorthand and the object form's `tag`/`shadow`/`props`/
 * `extend`). Those are the `<svelte:options>` fields `src/parser/runes-props.ts`
 * reads. Doesn't validate reserved tag names or malformed objects - a
 * malformed property is skipped rather than erroring. The shim test drops
 * any field this doesn't populate, and structurally compares whatever it
 * does against svelte's own `read_options`, so shapes here must match
 * `AST.SvelteOptions['customElement']` exactly (e.g. `extend` stays the raw
 * expression node, not a boolean).
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
      const customElement = getCustomElement(attribute);
      if (customElement !== undefined) options.customElement = customElement;
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

type CustomElement = NonNullable<AST.SvelteOptions["customElement"]>;
type CustomElementPropConfig = NonNullable<CustomElement["props"]>[string];

const CUSTOM_ELEMENT_PROP_TYPES = new Set(["String", "Boolean", "Number", "Array", "Object"]);

/** Non-computed `Identifier`-keyed properties of an `ObjectExpression`, as `[name, value]` pairs. */
function namedProperties(objectExpression: { properties: unknown[] }): Array<[string, unknown]> {
  const pairs: Array<[string, unknown]> = [];
  for (const property of objectExpression.properties) {
    if (
      !property ||
      typeof property !== "object" ||
      (property as { type?: string }).type !== "Property" ||
      (property as { computed?: boolean }).computed ||
      (property as { key?: { type?: string } }).key?.type !== "Identifier"
    ) {
      continue;
    }
    const { key, value } = property as { key: { name: string }; value: unknown };
    pairs.push([key.name, value]);
  }
  return pairs;
}

/** `customElement.props.<name>` config: `{ attribute?, reflect?, type? }`. Invalid entries are skipped. */
function getCustomElementPropConfig(value: unknown): CustomElementPropConfig {
  const config: CustomElementPropConfig = {};
  if (!value || typeof value !== "object" || (value as { type?: string }).type !== "ObjectExpression") return config;

  for (const [name, propValue] of namedProperties(value as { properties: unknown[] })) {
    if (!propValue || typeof propValue !== "object" || (propValue as { type?: string }).type !== "Literal") continue;
    const literalValue = (propValue as { value: unknown }).value;

    if (name === "attribute" && typeof literalValue === "string") {
      config.attribute = literalValue;
    } else if (name === "reflect" && typeof literalValue === "boolean") {
      config.reflect = literalValue;
    } else if (name === "type" && typeof literalValue === "string" && CUSTOM_ELEMENT_PROP_TYPES.has(literalValue)) {
      config.type = literalValue as "String" | "Boolean" | "Number" | "Array" | "Object";
    }
  }

  return config;
}

/**
 * Parses `customElement="my-el"` (shorthand) or `customElement={{ tag, shadow,
 * props, extend }}` (object form) into svelte's own `AST.SvelteOptions['customElement']`
 * shape. `shadow`'s `ObjectExpression` form and `extend` are kept as the raw
 * expression node (unused by sveld beyond presence checks downstream), matching
 * what svelte's real parser produces, for shim-test parity.
 */
function getCustomElement(attribute: AST.Attribute): AST.SvelteOptions["customElement"] {
  const { value } = attribute;
  if (value === true) return undefined;

  const chunk = Array.isArray(value) ? value[0] : value;
  if (!chunk) return undefined;

  // `customElement="my-el"` shorthand.
  if (chunk.type === "Text") {
    const tag = getStaticValue(attribute);
    return typeof tag === "string" ? { tag } : undefined;
  }

  const expression = chunk.expression;
  if (expression.type === "Literal" && expression.value === null) return undefined;
  if (expression.type !== "ObjectExpression") return undefined;

  const properties = namedProperties(expression);
  const customElement: CustomElement = {};

  const tagValue = properties.find(([name]) => name === "tag")?.[1];
  if (
    tagValue &&
    typeof tagValue === "object" &&
    (tagValue as { type?: string }).type === "Literal" &&
    typeof (tagValue as { value: unknown }).value === "string"
  ) {
    customElement.tag = (tagValue as { value: string }).value;
  }

  const propsValue = properties.find(([name]) => name === "props")?.[1];
  if (propsValue && typeof propsValue === "object" && (propsValue as { type?: string }).type === "ObjectExpression") {
    customElement.props = {};
    for (const [name, config] of namedProperties(propsValue as { properties: unknown[] })) {
      customElement.props[name] = getCustomElementPropConfig(config);
    }
  }

  const shadowValue = properties.find(([name]) => name === "shadow")?.[1];
  if (shadowValue && typeof shadowValue === "object") {
    const shadowNode = shadowValue as { type?: string; value?: unknown };
    if (shadowNode.type === "Literal" && (shadowNode.value === "open" || shadowNode.value === "none")) {
      customElement.shadow = shadowNode.value;
    } else if (shadowNode.type === "ObjectExpression") {
      // biome-ignore lint/suspicious/noExplicitAny: mirrors svelte's own `AST.SvelteOptions['customElement']['shadow']`, which types this branch as a raw `ObjectExpression`.
      customElement.shadow = shadowValue as any;
    }
  }

  const extendValue = properties.find(([name]) => name === "extend")?.[1];
  if (extendValue !== undefined) {
    // biome-ignore lint/suspicious/noExplicitAny: mirrors svelte's own `AST.SvelteOptions['customElement']['extend']`, a raw `ArrowFunctionExpression | Identifier` node.
    customElement.extend = extendValue as any;
  }

  return customElement;
}
