import type { DeprecatedValue } from "../ComponentParser";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { buildComponentApiDocument } from "./document-model";

/**
 * Minimal local subset of the published Custom Elements Manifest schema
 * (schemaVersion "1.0.0") for the fields sveld can populate. See
 * https://github.com/webcomponents/custom-elements-manifest for the full spec.
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
}

export interface CemAttribute {
  name: string;
  fieldName: string;
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
  members: CemClassField[];
  attributes: CemAttribute[];
  events: CemEvent[];
  slots: CemSlot[];
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

/**
 * Attribute-compatible prop types: primitives only. Anything else (arrays,
 * objects, unions, custom types) is skipped, since sveld doesn't attempt to
 * infer how a complex type reflects to a DOM attribute string.
 */
const PRIMITIVE_ATTRIBUTE_TYPES = new Set(["string", "number", "boolean"]);

function buildMembers(props: ComponentDocApi["props"]): CemClassField[] {
  return props.map((prop) => ({
    kind: "field",
    name: prop.name,
    ...(prop.type ? { type: { text: prop.type } } : {}),
    ...(prop.value === undefined ? {} : { default: prop.value }),
    ...(prop.description ? { description: prop.description } : {}),
    ...(prop.deprecated === undefined ? {} : { deprecated: prop.deprecated }),
  }));
}

/**
 * Derives attributes from props whose name is already attribute-compatible
 * (Svelte's custom-element runtime lowercases the prop name by default,
 * `key.toLowerCase()`) and whose type is a bare primitive. Props that would
 * collide on the same lowercased attribute name are dropped on both sides,
 * since which prop wins at runtime is ambiguous.
 */
function buildAttributes(props: ComponentDocApi["props"]): CemAttribute[] {
  const byAttributeName = new Map<string, ComponentDocApi["props"]>();

  for (const prop of props) {
    if (!prop.type || !PRIMITIVE_ATTRIBUTE_TYPES.has(prop.type.trim())) continue;

    const attributeName = prop.name.toLowerCase();
    const existing = byAttributeName.get(attributeName);
    if (existing) {
      existing.push(prop);
    } else {
      byAttributeName.set(attributeName, [prop]);
    }
  }

  const attributes: CemAttribute[] = [];
  for (const [attributeName, candidates] of byAttributeName) {
    if (candidates.length !== 1) continue;
    const prop = candidates[0];
    attributes.push({
      name: attributeName,
      fieldName: prop.name,
      type: { text: prop.type as string },
      ...(prop.value === undefined ? {} : { default: prop.value }),
      ...(prop.description ? { description: prop.description } : {}),
    });
  }

  return attributes;
}

function buildEvents(events: ComponentDocApi["events"]): CemEvent[] {
  return events
    .filter((event) => event.type === "dispatched")
    .map((event) => ({
      name: event.name,
      type: { text: `CustomEvent<${event.detail ?? "unknown"}>` },
      ...(event.description ? { description: event.description } : {}),
      ...(event.deprecated === undefined ? {} : { deprecated: event.deprecated }),
    }));
}

function buildSlots(slots: ComponentDocApi["slots"]): CemSlot[] {
  return slots.map((slot) => ({
    name: slot.default ? "" : (slot.name ?? ""),
    ...(slot.description ? { description: slot.description } : {}),
    ...(slot.deprecated === undefined ? {} : { deprecated: slot.deprecated }),
  }));
}

function buildDeclaration(component: ComponentDocApi): CemClassDeclaration {
  const declaration: CemClassDeclaration = {
    kind: "class",
    name: component.moduleName,
    ...(component.componentComment ? { description: component.componentComment } : {}),
    members: buildMembers(component.props),
    attributes: buildAttributes(component.props),
    events: buildEvents(component.events),
    slots: buildSlots(component.slots),
  };

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
