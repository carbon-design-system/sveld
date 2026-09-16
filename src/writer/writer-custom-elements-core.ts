import type { DeprecatedValue } from "../ComponentParser";
import { splitTopLevelCommas } from "../parser/generics";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { buildComponentApiDocument } from "./document-model";

/**
 * Minimal local subset of the published Custom Elements Manifest schema
 * (schemaVersion "1.0.0") for the fields sveld can populate. See
 * https://github.com/webcomponents/custom-elements-manifest for the full spec.
 *
 * The CEM spec has no field for JSDoc passthrough tags (`@since`, `@example`,
 * `@see`), so members/events/slots below carry `description` and
 * `deprecated` only; `tags` is intentionally not read here.
 */
export interface CemType {
  text: string;
}

export interface CemClassField {
  kind: "field";
  name: string;
  type?: CemType;
  default?: string;
  description?: string;
  deprecated?: DeprecatedValue;
  /** Present, and `true`, for an `export const` prop. */
  readonly?: true;
}

interface CemParameter {
  name: string;
  type?: CemType;
  optional?: true;
  rest?: true;
}

/** An `export function` prop (a Svelte accessor), mapped to a method instead of a field. */
interface CemClassMethod {
  kind: "method";
  name: string;
  static: boolean;
  parameters?: CemParameter[];
  return?: { type: CemType };
  description?: string;
  deprecated?: DeprecatedValue;
}

export interface CemAttribute {
  name: string;
  fieldName: string;
  type?: CemType;
  default?: string;
  description?: string;
  /** Present, and `true`, when the prop's `customElement` config sets `reflect: true`. */
  reflects?: true;
}

interface CemCssPart {
  name: string;
  description?: string;
}

/**
 * The published schema names this field `syntax` (a strict CSS
 * `@property`-style syntax string, e.g. `"<color>"`). sveld's `@cssprop
 * {type}` is free-form prose (e.g. `"Color"`), so it's emitted as `type.text`
 * instead, matching every other typed field in this manifest.
 */
interface CemCssCustomProperty {
  /** Includes the leading `--`. */
  name: string;
  type?: CemType;
  default?: string;
  description?: string;
}

export interface CemEvent {
  name: string;
  type: CemType;
  description?: string;
  deprecated?: DeprecatedValue;
}

export interface CemSlot {
  name: string;
  description?: string;
  deprecated?: DeprecatedValue;
}

export interface CemClassDeclaration {
  kind: "class";
  name: string;
  description?: string;
  members: Array<CemClassField | CemClassMethod>;
  attributes: CemAttribute[];
  events: CemEvent[];
  slots: CemSlot[];
  /** From component-level `@csspart` JSDoc tags. */
  cssParts?: CemCssPart[];
  /** From component-level `@cssprop`/`@cssproperty` JSDoc tags. */
  cssProperties?: CemCssCustomProperty[];
  /** Only present when the source component sets `<svelte:options customElement="..." />`. */
  tagName?: string;
  /** Only present when the source component sets `<svelte:options customElement="..." />`. */
  customElement?: true;
}

export interface CemJavaScriptExport {
  kind: "js";
  name: string;
  declaration: { name: string; module: string };
}

export interface CemCustomElementExport {
  kind: "custom-element-definition";
  name: string;
  declaration: { name: string; module: string };
}

export type CemExport = CemJavaScriptExport | CemCustomElementExport;

export interface CemModule {
  kind: "javascript-module";
  path: string;
  declarations: CemClassDeclaration[];
  exports: CemExport[];
}

export interface CustomElementsManifest {
  schemaVersion: "1.0.0";
  modules: CemModule[];
}

type ComponentPropApi = ComponentDocApi["props"][number];

/**
 * Splits an accessor's TS signature text (e.g. `"(input: string) => number"`,
 * produced by {@link buildFunctionDeclarationSignature} when there's no
 * `@param`/`@returns` JSDoc to prefer instead) into CEM parameters/return.
 * Textual split, not a real type parse: params are whatever's between the
 * signature's leading balanced `(...)`, split on top-level commas.
 */
const ARROW_PREFIX_REGEX = /^=>\s*/;

function parseAccessorSignatureText(signature: string): { parameters: CemParameter[]; returnTypeText: string } {
  const trimmed = signature.trim();
  if (!trimmed.startsWith("(")) return { parameters: [], returnTypeText: trimmed || "any" };

  let depth = 0;
  let closeIndex = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "(") depth++;
    else if (trimmed[i] === ")") {
      depth--;
      if (depth === 0) {
        closeIndex = i;
        break;
      }
    }
  }
  if (closeIndex === -1) return { parameters: [], returnTypeText: "any" };

  const paramsText = trimmed.slice(1, closeIndex).trim();
  const returnText = trimmed
    .slice(closeIndex + 1)
    .trim()
    .replace(ARROW_PREFIX_REGEX, "");

  const parameters =
    paramsText === ""
      ? []
      : splitTopLevelCommas(paramsText).map((paramText): CemParameter => {
          const text = paramText.trim();
          const isRest = text.startsWith("...");
          const rest = isRest ? text.slice(3) : text;
          const colonIndex = rest.indexOf(":");
          const namePart = (colonIndex === -1 ? rest : rest.slice(0, colonIndex)).trim();
          const typeText = colonIndex === -1 ? undefined : rest.slice(colonIndex + 1).trim();
          const optional = namePart.endsWith("?");

          const parameter: CemParameter = { name: optional ? namePart.slice(0, -1) : namePart };
          if (typeText) parameter.type = { text: typeText };
          if (optional) parameter.optional = true;
          if (isRest) parameter.rest = true;
          return parameter;
        });

  return { parameters, returnTypeText: returnText || "any" };
}

/**
 * Parameters/return for an `export function` accessor prop. JSDoc
 * `@param`/`@returns` win when present (already structured on the prop);
 * otherwise falls back to splitting the prop's TS signature text.
 */
function accessorParametersAndReturn(prop: ComponentPropApi): { parameters: CemParameter[]; returnTypeText: string } {
  if (prop.params !== undefined || prop.returnType !== undefined) {
    const parameters = (prop.params ?? []).map((param): CemParameter => {
      const parameter: CemParameter = { name: param.name };
      if (param.type) parameter.type = { text: param.type };
      if (param.optional) parameter.optional = true;
      return parameter;
    });
    return { parameters, returnTypeText: prop.returnType ?? "any" };
  }

  return prop.type ? parseAccessorSignatureText(prop.type) : { parameters: [], returnTypeText: "any" };
}

function buildMembers(props: ComponentDocApi["props"]): Array<CemClassField | CemClassMethod> {
  return props.map((prop): CemClassField | CemClassMethod => {
    if (prop.isFunctionDeclaration) {
      const { parameters, returnTypeText } = accessorParametersAndReturn(prop);
      // Fields are assigned in schema order (no conditional spreads, which
      // allocate and copy a throwaway object per optional field).
      const method: CemClassMethod = { kind: "method", name: prop.name, static: false };
      if (parameters.length > 0) method.parameters = parameters;
      method.return = { type: { text: returnTypeText } };
      if (prop.description) method.description = prop.description;
      if (prop.deprecated !== undefined) method.deprecated = prop.deprecated;
      return method;
    }

    const field: CemClassField = { kind: "field", name: prop.name };
    if (prop.type) field.type = { text: prop.type };
    if (prop.value !== undefined) field.default = prop.value;
    if (prop.description) field.description = prop.description;
    if (prop.deprecated !== undefined) field.deprecated = prop.deprecated;
    if (prop.kind === "const") field.readonly = true;
    return field;
  });
}

/**
 * Derives attributes from every prop (Svelte's custom-element runtime
 * observes an attribute for every prop by default, converting to/from JSON
 * for `Array`/`Object`-typed props), excluding `export function` accessors
 * (those aren't part of Svelte's props definition; see {@link buildMembers}).
 * The attribute name is the `customElement.props.<name>.attribute` config
 * when present, the lowercased prop name otherwise; `attribute: false` in
 * that config omits the prop's attribute entirely. Props that collide on the
 * same attribute name keep the first (in declaration order); the rest are
 * skipped with a console warning, since which prop wins at runtime is
 * ambiguous.
 */
function buildAttributes(component: ComponentDocApi): CemAttribute[] {
  const propConfigs = component.customElement?.props;
  const claimedBy = new Map<string, string>();
  const attributes: CemAttribute[] = [];

  for (const prop of component.props) {
    if (prop.isFunctionDeclaration) continue;

    const config = propConfigs?.[prop.name];
    if (config?.attribute === false) continue;

    const attributeName = config?.attribute || prop.name.toLowerCase();
    const claimedByFieldName = claimedBy.get(attributeName);
    if (claimedByFieldName !== undefined) {
      console.warn(
        `sveld: props "${claimedByFieldName}" and "${prop.name}" of component "${component.moduleName}" both map to the custom-element attribute "${attributeName}"; only "${claimedByFieldName}" is included.`,
      );
      continue;
    }
    claimedBy.set(attributeName, prop.name);

    const isJsonSerialized = config?.type === "Array" || config?.type === "Object";
    const description = isJsonSerialized
      ? [prop.description, "Serialized to/from JSON for the attribute."].filter(Boolean).join(" ")
      : prop.description;

    const attribute: CemAttribute = { name: attributeName, fieldName: prop.name };
    if (prop.type) attribute.type = { text: prop.type };
    if (prop.value !== undefined) attribute.default = prop.value;
    if (description) attribute.description = description;
    if (config?.reflect) attribute.reflects = true;
    attributes.push(attribute);
  }

  return attributes;
}

function buildCssParts(cssParts: ComponentDocApi["cssParts"]): CemCssPart[] | undefined {
  if (!cssParts || cssParts.length === 0) return undefined;
  return cssParts.map((cssPart) => {
    const part: CemCssPart = { name: cssPart.name };
    if (cssPart.description) part.description = cssPart.description;
    return part;
  });
}

function buildCssProperties(cssProperties: ComponentDocApi["cssProperties"]): CemCssCustomProperty[] | undefined {
  if (!cssProperties || cssProperties.length === 0) return undefined;
  return cssProperties.map((cssProperty) => {
    const property: CemCssCustomProperty = { name: cssProperty.name };
    if (cssProperty.type) property.type = { text: cssProperty.type };
    if (cssProperty.default !== undefined) property.default = cssProperty.default;
    if (cssProperty.description) property.description = cssProperty.description;
    return property;
  });
}

function buildEvents(events: ComponentDocApi["events"]): CemEvent[] {
  return events
    .filter((event) => event.type === "dispatched")
    .map((event) => {
      const cemEvent: CemEvent = { name: event.name, type: { text: `CustomEvent<${event.detail ?? "unknown"}>` } };
      if (event.description) cemEvent.description = event.description;
      if (event.deprecated !== undefined) cemEvent.deprecated = event.deprecated;
      return cemEvent;
    });
}

function buildSlots(slots: ComponentDocApi["slots"]): CemSlot[] {
  return slots.map((slot) => {
    const cemSlot: CemSlot = { name: slot.default ? "" : (slot.name ?? "") };
    if (slot.description) cemSlot.description = slot.description;
    if (slot.deprecated !== undefined) cemSlot.deprecated = slot.deprecated;
    return cemSlot;
  });
}

function buildDeclaration(component: ComponentDocApi): CemClassDeclaration {
  const cssParts = buildCssParts(component.cssParts);
  const cssProperties = buildCssProperties(component.cssProperties);

  const members = buildMembers(component.props);
  const attributes = buildAttributes(component);
  const events = buildEvents(component.events);
  const slots = buildSlots(component.slots);
  const name = component.moduleName;

  // Two literals rather than a conditional spread for `description`, so the
  // schema key order is kept without copying a throwaway object.
  const declaration: CemClassDeclaration = component.componentComment
    ? { kind: "class", name, description: component.componentComment, members, attributes, events, slots }
    : { kind: "class", name, members, attributes, events, slots };
  if (cssParts) declaration.cssParts = cssParts;
  if (cssProperties) declaration.cssProperties = cssProperties;

  if (component.customElementTag) {
    declaration.tagName = component.customElementTag;
    declaration.customElement = true;
  }

  return declaration;
}

function buildExports(component: ComponentDocApi, modulePath: string): CemExport[] {
  const exports: CemExport[] = [
    {
      kind: "js",
      name: component.moduleName,
      declaration: { name: component.moduleName, module: modulePath },
    },
  ];

  if (component.customElementTag) {
    exports.push({
      kind: "custom-element-definition",
      name: component.customElementTag,
      declaration: { name: component.moduleName, module: modulePath },
    });
  }

  return exports;
}

export interface BuildCustomElementsManifestOptions {
  /** Resolves each component's manifest `path`. Defaults to the component's `filePath` as-is. */
  resolveModulePath?: (component: ComponentDocApi) => string;
}

/**
 * Builds a Custom Elements Manifest (schemaVersion "1.0.0") in memory, with
 * no file-system or `node:*` dependency so it can run in the browser (e.g.
 * the playground).
 */
export function buildCustomElementsManifest(
  components: ComponentDocs,
  options: BuildCustomElementsManifestOptions = {},
): CustomElementsManifest {
  const document = buildComponentApiDocument(components);
  const resolveModulePath = options.resolveModulePath ?? ((component: ComponentDocApi) => component.filePath);

  const modules: CemModule[] = document.components.map((component) => {
    const modulePath = resolveModulePath(component);
    return {
      kind: "javascript-module",
      path: modulePath,
      declarations: [buildDeclaration(component)],
      exports: buildExports(component, modulePath),
    };
  });

  return {
    schemaVersion: "1.0.0",
    modules,
  };
}
