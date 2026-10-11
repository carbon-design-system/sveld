import type { ComponentClassMember, ComponentProp, DeprecatedValue } from "../model";
import { getParsedComponentTypeScriptMetadata } from "../parsed-component-metadata";
import { escapeCommentText, escapeRegExp, formatParamList } from "../parser/utils";
import type { ComponentDocApi } from "../plugin";
import { indexOfTopLevelArrow, isTupleType, splitTopLevel } from "../type-text";
import { formatGeneratedTypeScript } from "./format-generated-ts";

const ANY_TYPE = "any";

/** Svelte 4 rejects `{}`; use `Record<string, any>` for empty events. */
const EMPTY_EVENTS = "Record<string, any>";

/** Avoids banned `{}` type; use `Record<string, never>` for empty objects. */
const EMPTY_OBJECT = "Record<string, never>";

const IDENTIFIER_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const CUSTOM_EVENT_REGEX = /CustomEvent/;
/** A capitalized name: a component rather than an HTML element. */
const COMPONENT_NAME_REGEX = /^[A-Z]/;
const NEWLINE_REGEX = /\n/;
const FUNCTION_TYPE_REGEX = /=>/;
/** A type that can open a function type: its parameter list or type parameters. */
const FUNCTION_TYPE_START_REGEX = /^\s*[(<]/;
/** An `@default` tag line in a description. */
const DESCRIPTION_DEFAULT_TAG_REGEX = /(?:^|\n)@default\b/;
/** A comment line of only `*` plus trailing spaces, capturing all but the spaces. */
const BLANK_COMMENT_LINE_REGEX = /^([ \t]*\*) +$/gm;
const WHITESPACE_REGEX = /\s+/g;
/** A reference to the `Snippet` type, not as a member (`x.Snippet`) or part of a longer name. */
const SNIPPET_TYPE_REFERENCE_REGEX = /(^|[^.\w])Snippet(?:\s*<|\b)/;
/** A preserved `import type { Snippet } from "svelte"`. */
const PRESERVED_SNIPPET_IMPORT_REGEX = /import\s+type\s+[^;]*\bSnippet\b[^;]*from\s+"svelte";/;
const LEADING_CONST_MODIFIER_REGEX = /^const\s+/;
const LEADING_EXPORT_REGEX = /^export /;
const NON_IDENTIFIER_CHAR_REGEX = /[^\w$]/g;

/**
 * `const` type parameters are legal on classes, functions, and methods but not
 * on `type` aliases (TS1277), so only alias declarations strip it.
 */
function stripConstModifierForTypeAlias(constraint: string): string {
  return constraint.replace(LEADING_CONST_MODIFIER_REGEX, "");
}

type JsDocTags = Array<{ name: string; body: string }> | undefined;

/** A `/** ... *\/` block with one ` * ` line per entry, or `""` without lines. */
function formatJsDocBlock(lines: string[]): string {
  if (lines.length === 0) return "";
  return `/**\n * ${escapeCommentText(lines.join("\n * "))}\n */`;
}

function descriptionLines(description: string | undefined): string[] {
  return description ? description.split("\n") : [];
}

function deprecatedLines(deprecated: DeprecatedValue | undefined): string[] {
  if (deprecated === undefined) return [];
  return (deprecated === true ? "@deprecated" : `@deprecated ${deprecated}`).split("\n");
}

function expandJsDocTagLines(tags: JsDocTags): string[] {
  const lines: string[] = [];
  for (const { name, body } of tags ?? []) {
    if (!body) lines.push(`@${name}`);
    else if (body.includes("\n")) lines.push(`@${name}`, ...body.split("\n"));
    else lines.push(`@${name} ${body}`);
  }
  return lines;
}

/** JSDoc lines for a prop, accessor, module export, or class member: `@deprecated` precedes the other tags. */
function memberJsDocLines(description: string | undefined, deprecated: DeprecatedValue | undefined, tags: JsDocTags) {
  return [...descriptionLines(description), ...deprecatedLines(deprecated), ...expandJsDocTagLines(tags)];
}

function formatSingleLineComment(description: string | undefined): string {
  if (!description) return "";
  return `/** ${escapeCommentText(description)} */`;
}

function formatComment(description: string | undefined): string {
  return description?.includes("\n")
    ? formatJsDocBlock(descriptionLines(description))
    : formatSingleLineComment(description);
}

/** JSDoc for a slot or event (and the snippet/callback prop standing in for one): `@deprecated` follows the other tags. */
function formatSlotJsDoc(description: string | undefined, tags: JsDocTags, deprecated: DeprecatedValue | undefined) {
  const tagLines = [...expandJsDocTagLines(tags), ...deprecatedLines(deprecated)];
  if (tagLines.length === 0) return formatComment(description);
  return formatJsDocBlock([...descriptionLines(description), ...tagLines]);
}

export function formatTsProps(props?: string) {
  if (props === undefined) return ANY_TYPE;
  return `${props}\n`;
}

export function getTypeDefs(def: Pick<ComponentDocApi, "typedefs">) {
  if (def.typedefs.length === 0) return "";
  return def.typedefs
    .map((typedef) => {
      const comment = formatJsDocBlock([
        ...descriptionLines(typedef.description),
        ...expandJsDocTagLines(typedef.tags),
      ]);
      const typedefComment = comment ? `${comment}\n` : "";
      // Markdown prints this as is, not through the .d.ts formatter, so drop the
      // trailing space a paragraph break leaves on its ` * ` line.
      return `${typedefComment}export ${typedef.ts}`.replace(BLANK_COMMENT_LINE_REGEX, "$1");
    })
    .join("\n\n");
}

const referencesGenericRegexCache = new Map<string, RegExp>();

/** Word-boundary match, so `Value` doesn't match `ValueType`. */
function referencesGeneric(propType: string, name: string): boolean {
  let regex = referencesGenericRegexCache.get(name);
  if (regex === undefined) {
    regex = new RegExp(`\\b${escapeRegExp(name)}\\b`);
    referencesGenericRegexCache.set(name, regex);
  }
  return regex.test(propType);
}

/** Several sites split the same `generics[1]` per component; a last-input memo avoids re-splitting. */
let lastSplitTopLevelCommasInput: string | undefined;
let lastSplitTopLevelCommasResult: string[] = [];
function splitTopLevelCommasMemo(input: string): string[] {
  if (input !== lastSplitTopLevelCommasInput) {
    lastSplitTopLevelCommasInput = input;
    lastSplitTopLevelCommasResult = splitTopLevel(input, ",");
  }
  return lastSplitTopLevelCommasResult;
}

/**
 * Pairs each generic name with its constraint (`Row extends Foo = Foo`). Names drive
 * the pairing; constraints split only at top-level commas (`Record<string, any>`).
 */
function getGenericParams(generics: ComponentDocApi["generics"]): Array<{ name: string; constraint: string }> {
  if (generics === null) return [];
  return generics[0].split(",").map((name, index) => ({
    name: name.trim(),
    constraint: (splitTopLevelCommasMemo(generics[1] ?? "")[index] ?? name).trim(),
  }));
}

/**
 * Only the generics `text` references, in declaration order: `declSuffix` with
 * constraints (`<Row extends Foo = Bar>`), `refSuffix` names only (`<Row>`).
 */
function computeReferencedGenerics(generics: ComponentDocApi["generics"], text: string) {
  const referenced = getGenericParams(generics).filter(({ name }) => referencesGeneric(text, name));

  if (referenced.length === 0) return { declSuffix: "", refSuffix: "" };

  return {
    declSuffix: `<${referenced.map(({ constraint }) => stripConstModifierForTypeAlias(constraint)).join(", ")}>`,
    refSuffix: `<${referenced.map(({ name }) => name).join(", ")}>`,
  };
}

/**
 * Exported context type definitions for a component, each parameterized with
 * only the generics it references, or an empty string if there are no contexts.
 *
 * @example
 * ```ts
 * // export type ModalContext<T> = {
 * //   open: () => void;
 * //   close: () => void;
 * // };
 * ```
 */
export function getContextDefs(def: Pick<ComponentDocApi, "contexts" | "generics">) {
  if (!def.contexts || def.contexts.length === 0) return "";

  return def.contexts
    .map((context) => {
      const props = context.properties
        .map((prop) => {
          const comment = prop.description ? `${formatSingleLineComment(prop.description)}\n  ` : "";
          const optional = prop.optional ? "?" : "";
          return `${comment}${formatKey(prop.name)}${optional}: ${prop.type};`;
        })
        .join("\n  ");

      const contextComment = context.description ? `${formatJsDocBlock(descriptionLines(context.description))}\n` : "";
      const { declSuffix: genericSuffix } = computeReferencedGenerics(
        def.generics,
        [context.type ?? "", ...context.properties.map((prop) => prop.type)].join("\n"),
      );

      // A variable passed as the whole value: `getContext` returns it as-is.
      if (context.type !== undefined) {
        return `${contextComment}export type ${context.typeName}${genericSuffix} = ${context.type};`;
      }

      if (context.properties.length === 0) {
        return `${contextComment}export type ${context.typeName} = ${context.hasUnresolvedSpread ? "Record<string, any>" : EMPTY_OBJECT};`;
      }

      const widenSuffix = context.hasUnresolvedSpread ? " & Record<string, any>" : "";

      return `${contextComment}export type ${context.typeName}${genericSuffix} = {\n  ${props}\n}${widenSuffix};`;
    })
    .join("\n\n");
}

/**
 * A member key or export specifier name: bare when a valid identifier, else
 * JSON-quoted (`"data-foo"`, `export { "a-b" as x }`).
 */
function formatKey(key: string): string {
  return IDENTIFIER_REGEX.test(key) ? key : JSON.stringify(key);
}

/**
 * Svelte 5 type-checks slot content through snippet props. Slot props are the
 * snippet's one argument; a tuple (`@snippet {[A, B]}`) is its parameter list.
 */
function genSnippetProp(key: string, slot: ComponentDocApi["slots"][number]): string {
  const comment = formatSlotJsDoc(slot.description, slot.tags, slot.deprecated);
  const description = comment ? `${comment}\n      ` : "";
  const args = !slot.slot_props || slot.slot_props === EMPTY_OBJECT ? "[]" : snippetArgs(slot.slot_props);
  const snippetType = args === "[]" ? "(this: void) => void" : `(this: void, ...args: ${args}) => void`;
  return `
      ${description}${key}?: ${snippetType};`;
}

/**
 * Generates the `$Props` type for a component.
 *
 * @example
 * ```ts
 * // type $Props<T extends string = "default"> = {
 * //   count?: number;
 * //   header?: (this: void, ...args: [{ title: string }]) => void;
 * //   children?: (this: void) => void;
 * // };
 * ```
 */
function genPropDef(
  def: Pick<ComponentDocApi, "props" | "rest_props" | "moduleName" | "extends" | "generics" | "slots"> & {
    canonicalPropNames?: Set<string>;
    canonicalPropsType?: string;
  },
) {
  const nonAccessorProps = def.props.filter((prop) => !isAccessorProp(prop));
  // Slot snippet props must not collide with real props.
  const existingPropNames = new Set([
    ...nonAccessorProps.map((prop) => prop.name),
    ...Array.from(def.canonicalPropNames ?? []),
  ]);
  const ownProps = def.canonicalPropsType
    ? nonAccessorProps.filter((prop) => !def.canonicalPropNames?.has(prop.name))
    : nonAccessorProps;

  const members = ownProps.map((prop) => {
    const defaultValue = typeof prop.value === "string" ? prop.value.replace(WHITESPACE_REGEX, " ") : prop.value;

    /**
     * Function props only carry a `value` when a concise default was inferred
     * (see `conciseFunctionDefaultText`, #203). An explicit `@default` in the
     * description wins, and `= undefined` is already implied by `?`.
     */
    const suppressDefault =
      DESCRIPTION_DEFAULT_TAG_REGEX.test(prop.description ?? "") ||
      prop.value === undefined ||
      prop.value === "undefined";

    const comment = formatJsDocBlock([
      ...memberJsDocLines(prop.description, prop.deprecated, prop.tags),
      ...(prop.constant ? ["@constant"] : []),
      ...(suppressDefault ? [] : [`@default ${defaultValue}`]),
    ]);

    const prop_value = prop.constant && !prop.isFunction ? prop.value : prop.type || ANY_TYPE;

    return `
      ${comment}
      ${formatKey(prop.name)}${prop.isRequired ? "" : "?"}: ${prop_value};`;
  });

  for (const slot of def.slots) {
    if (!slot.default && slot.name != null && !existingPropNames.has(slot.name)) {
      members.push(genSnippetProp(formatKey(slot.name), slot));
    }
  }
  const defaultSlot = def.slots.find((slot) => slot.default || slot.name === null);
  if (defaultSlot && !existingPropNames.has("children")) {
    members.push(genSnippetProp("children", defaultSlot));
  }

  const props = members.join("\n");
  const props_name = propsTypeName(def.moduleName);

  // Declaration form (`type $Props<T extends Foo = Bar>`) vs reference form (`$Props<T>`).
  const genericsName = def.generics
    ? `<${splitTopLevelCommasMemo(def.generics[1])
        .map((constraint) => stripConstModifierForTypeAlias(constraint.trim()))
        .join(", ")}>`
    : "";
  const genericsNameRef = def.generics ? `<${def.generics[0]}>` : "";
  const extendsPrefix =
    def.extends === undefined ? "" : `Omit<${def.extends.interface}, keyof $Props${genericsNameRef}> & `;
  const propsRef = `${extendsPrefix}$Props${genericsNameRef}`;
  const exportProps = (type: string) => `export type ${props_name}${genericsName} = ${type};`;
  const ownMembers = `{${props}\n}`;

  if (def.rest_props?.type !== "Element") {
    let declarations: string[];
    if (def.canonicalPropsType) {
      const own = props.trim() === "" ? "" : ` & ${ownMembers}`;
      declarations = [`type $Props${genericsName} = ${def.canonicalPropsType}${own};`, exportProps(propsRef)];
    } else if (def.extends === undefined) {
      // Never emit `{}`: Svelte 4 rejects it and Biome bans it.
      declarations = [exportProps(props.trim() === "" ? EMPTY_OBJECT : ownMembers)];
    } else {
      declarations = [`type $Props${genericsName} = ${ownMembers};`, exportProps(propsRef)];
    }
    return { props_name, prop_def: declarations.join("\n\n"), elementsImport: undefined };
  }

  const { name, thisValue, thisType, description } = def.rest_props;
  let restPropsType: string;
  if (name !== "svelte:element") {
    restPropsType = name
      .split("|")
      .map((element) => `SvelteHTMLElements["${element.trim()}"]`)
      .join(" & ");
  } else if (thisValue) {
    restPropsType = `SvelteHTMLElements["${thisValue}"]`;
  } else if (thisType) {
    // `NoInfer` keeps the other props from inferring the tag, so no `tag` means its default.
    restPropsType = `NoInfer<SvelteHTMLElements[${thisType}]>`;
  } else {
    // Dynamic `this`: the element type is unknown at compile time.
    restPropsType = "HTMLAttributes<HTMLElement>";
  }

  // Preserves `data-*` attrs for Svelte 3 HTML-extending components.
  // See https://github.com/sveltejs/language-tools/issues/1825
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a TypeScript template literal type
  const dataAttributes = "[key: `data-${string}`]: unknown;";

  const restPropsComment = description ? `${formatComment(description)}\n` : "";
  const canonicalPrefix = def.canonicalPropsType ? `(${def.canonicalPropsType}) & ` : "";
  // A tag typed by a type parameter needs the component's type parameters in scope.
  const restPropsGenerics = thisType ? { name: genericsName, ref: genericsNameRef } : { name: "", ref: "" };
  const omittedKeys =
    def.extends === undefined
      ? `keyof $Props${genericsNameRef}`
      : `keyof ($Props${genericsNameRef} & ${def.extends.interface})`;
  const omittedRestProps = `Omit<$RestProps${restPropsGenerics.ref}, ${omittedKeys}>`;
  // Omitting from a union of element types (`tag: "div" | "section"`) is too
  // complex for TypeScript, so omit from each element type in turn.
  const restPropsSide = thisType ? `(${thisType} extends any ? ${omittedRestProps} : never)` : omittedRestProps;

  return {
    props_name,
    prop_def: [
      `${restPropsComment}type $RestProps${restPropsGenerics.name} = ${restPropsType};`,
      `type $Props${genericsName} = ${canonicalPrefix}{${props}\n\n${dataAttributes}\n};`,
      exportProps(`${restPropsSide} & ${propsRef}`),
    ].join("\n\n"),
    elementsImport: restPropsType.startsWith("HTMLAttributes") ? "HTMLAttributes" : "SvelteHTMLElements",
  };
}

function snippetArgs(slot_props: string) {
  return isTupleType(slot_props) ? slot_props : `[${slot_props}]`;
}

/** Legacy slots take one props object, so a snippet with positional parameters has no slot form. */
function genSlotDef(def: Pick<ComponentDocApi, "slots">) {
  const slots = def.slots.filter((slot) => !isTupleType(slot.slot_props ?? ""));
  if (slots.length === 0) return EMPTY_OBJECT;

  const slotDefs = slots
    .map(({ name, slot_props, ...rest }) => {
      const key = rest.default || name === null ? "default" : formatKey(name ?? "");
      const slotDefComment = formatSlotJsDoc(rest.description, rest.tags, rest.deprecated);
      const description = slotDefComment ? `${slotDefComment}\n` : "";
      return `${description}${key}: ${formatTsProps(slot_props)};`;
    })
    .join("\n");

  // Force multiline when count > 1 (matches interface body formatting).
  return slots.length === 1 ? `{${slotDefs}}` : `{\n${slotDefs}\n}`;
}

const STANDARD_DOM_EVENTS = new Set([
  "click",
  "dblclick",
  "mousedown",
  "mouseup",
  "mousemove",
  "mouseover",
  "mouseout",
  "mouseenter",
  "mouseleave",
  "contextmenu",
  "wheel",
  "keydown",
  "keyup",
  "keypress",
  "submit",
  "change",
  "input",
  "focus",
  "blur",
  "focusin",
  "focusout",
  "reset",
  "select",
  "touchstart",
  "touchend",
  "touchmove",
  "touchcancel",
  "drag",
  "dragstart",
  "dragend",
  "dragover",
  "dragenter",
  "dragleave",
  "drop",
  "pointerdown",
  "pointerup",
  "pointermove",
  "pointerover",
  "pointerout",
  "pointerenter",
  "pointerleave",
  "pointercancel",
  "gotpointercapture",
  "lostpointercapture",
  "play",
  "pause",
  "ended",
  "volumechange",
  "timeupdate",
  "loadeddata",
  "loadedmetadata",
  "canplay",
  "canplaythrough",
  "seeking",
  "seeked",
  "playing",
  "waiting",
  "stalled",
  "suspend",
  "abort",
  "error",
  "emptied",
  "ratechange",
  "durationchange",
  "loadstart",
  "progress",
  "loadend",
  "animationstart",
  "animationend",
  "animationiteration",
  "animationcancel",
  "transitionstart",
  "transitionend",
  "transitionrun",
  "transitioncancel",
  "scroll",
  "resize",
  "load",
  "unload",
  "beforeunload",
  "cut",
  "copy",
  "paste",
  "compositionstart",
  "compositionupdate",
  "compositionend",
] satisfies readonly string[]);

/** `CustomEvent<detail>`, leaving a detail that already names `CustomEvent` (`@event {CustomEvent<null>}`) unwrapped. */
function createDispatchedEventType(detail: string = ANY_TYPE) {
  if (CUSTOM_EVENT_REGEX.test(detail)) return detail;
  return `CustomEvent<${detail}>`;
}

function computeEventTypeString(event: ComponentDocApi["events"][number]): string {
  switch (event.type) {
    case "dispatched":
      return createDispatchedEventType(event.detail);
    case "forwarded": {
      const elementName = event.element;
      const isComponent = elementName && COMPONENT_NAME_REGEX.test(elementName);
      const isStandardEvent = !isComponent || STANDARD_DOM_EVENTS.has(event.name);

      const hasExplicitDetail =
        event.detail !== undefined && event.detail !== "undefined" && !(event.detail === "null" && isStandardEvent);
      const hasExplicitNullForCustomComponent = event.detail === "null" && !isStandardEvent;

      if (hasExplicitDetail || hasExplicitNullForCustomComponent) return createDispatchedEventType(event.detail);
      return isStandardEvent ? `WindowEventMap["${event.name}"]` : createDispatchedEventType();
    }
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

function genEventDef(def: Pick<ComponentDocApi, "events">) {
  if (def.events.length === 0) return EMPTY_EVENTS;

  const events_map = def.events
    .map((event) => {
      const eventComment = formatSlotJsDoc(event.description, event.tags, event.deprecated);
      const description = eventComment ? `${eventComment}\n` : "";
      return `${description}${formatKey(event.name)}: ${computeEventTypeString(event)};\n`;
    })
    .join("");

  // Force multiline when count > 1 (matches interface body formatting).
  return def.events.length === 1 ? `{${events_map}}` : `{\n${events_map}}`;
}

/** Priority: a `@type` function type, then `@param`/`@returns`, then `prop.type`. */
function generateFunctionType(prop: {
  type?: string;
  params?: Array<{ name: string; type: string; optional?: boolean }>;
  returnType?: string;
}): string {
  const isDefaultFunctionType = prop.type === "() => any";

  if (prop.type && FUNCTION_TYPE_REGEX.test(prop.type) && !isDefaultFunctionType) return prop.type;
  if (prop.params && prop.params.length > 0) {
    return `(${formatParamList(prop.params)}) => ${prop.returnType || ANY_TYPE}`;
  }
  if (prop.returnType) return `() => ${prop.returnType}`;
  return prop.type || ANY_TYPE;
}

/** `export function` / `export const` in the instance script: a class member or `Exports` entry, not a prop. */
export function isAccessorProp(prop: ComponentProp): boolean {
  return prop.isFunctionDeclaration === true || prop.kind === "const";
}

function genAccessors(def: Pick<ComponentDocApi, "props">) {
  return def.props
    .filter(isAccessorProp)
    .map(
      (prop) => `
    ${formatJsDocBlock(memberJsDocLines(prop.description, prop.deprecated, prop.tags))}
    ${formatKey(prop.name)}: ${generateFunctionType(prop)};`,
    )
    .join("\n");
}

/**
 * `"component"` format's `Exports` type: the accessors `"class"` format renders as
 * class members, parameterized with only the generics they reference.
 */
function genExportsDef(def: Pick<ComponentDocApi, "props" | "moduleName" | "generics">) {
  const exports_name = exportsTypeName(def.moduleName);
  const accessors = genAccessors({ props: def.props });

  if (accessors.trim() === "") {
    return {
      exports_ref: exports_name,
      exports_def: `export type ${exports_name} = ${EMPTY_OBJECT};`,
    };
  }

  const { declSuffix, refSuffix } = computeReferencedGenerics(def.generics, accessors);

  return {
    exports_ref: `${exports_name}${refSuffix}`,
    exports_def: `export type ${exports_name}${declSuffix} = {${accessors}\n  };`,
  };
}

/** `"component"` format's `Bindings` union: `$bindable(...)` or `@bindable writable` prop names, else `""`. */
function genBindingsUnion(def: Pick<ComponentDocApi, "props">): string {
  const names = def.props
    .filter((prop) => prop.bindable === true || prop.binding === "writable")
    .map((prop) => JSON.stringify(prop.name));
  return names.length > 0 ? names.join(" | ") : '""';
}

/** An anonymous default export (`moduleName` "default") still needs a declaration name. */
function componentIdentifier(moduleName: string): string {
  return moduleName === "default" ? "$$Component" : moduleName;
}

function genComponentDeclaration(def: { moduleName: string; propsRef: string; exportsRef: string; bindings: string }) {
  const identifier = componentIdentifier(def.moduleName);

  return `declare const ${identifier}: Component<
      ${def.propsRef},
      ${def.exportsRef},
      ${def.bindings}
    >;
    export default ${identifier};`;
}

/**
 * `"component"` format for generic components or ones with events, as an
 * interface instead of `Component<...>`: a `declare const` can't carry a type
 * parameter, and `Component` has no events slot (the language server checks
 * `on:event` usage against the typed `$on`). The `new` signature is required:
 * the template checker infers generics for `<Comp prop={...} />` through it,
 * not the call signature (`@sveltejs/package` emits both).
 */
function genComponentInterfaceDeclaration(def: {
  moduleName: string;
  generic: string;
  propsRef: string;
  exportsRef: string;
  bindings: string;
  eventsRef?: string;
}) {
  const identifier = componentIdentifier(def.moduleName);
  const interfaceName = `${identifier}Component`;
  const onSignature = def.eventsRef
    ? `$on?<K extends keyof ${def.eventsRef} & string>(type: K, callback: (e: ${def.eventsRef}[K]) => void): () => void;`
    : "$on?(type: string, callback: (e: any) => void): () => void;";

  return `interface ${interfaceName} {
      new ${def.generic}(
        options: ComponentConstructorOptions<${def.propsRef}>
      ): SvelteComponent<${def.propsRef}${def.eventsRef ? `, ${def.eventsRef}` : ""}> & ${def.exportsRef};
      ${def.generic}(
        this: void,
        internals: ComponentInternals,
        props: ${def.propsRef}
      ): {
        ${onSignature}
        $set?(props: Partial<${def.propsRef}>): void;
      } & ${def.exportsRef};
      element?: typeof HTMLElement;
      z_$$bindings?: ${def.bindings};
    }
    declare const ${identifier}: ${interfaceName};
    export default ${identifier};`;
}

function genImports(def: Pick<ComponentDocApi, "extends">) {
  if (def.extends === undefined) return "";
  return `import type { ${def.extends.interface} } from ${def.extends.import};`;
}

function genComponentComment(def: Pick<ComponentDocApi, "componentComment">) {
  if (!def.componentComment) return "";
  if (!NEWLINE_REGEX.test(def.componentComment)) {
    return formatSingleLineComment(def.componentComment.trim());
  }
  return `/*${escapeCommentText(def.componentComment)
    .split("\n")
    .map((line) => `* ${line}`)
    .join("\n")}\n*/`;
}

/**
 * Module-script re-exports, written as-is with their original specifier so
 * TypeScript resolves each name through that module's own types. Named
 * re-exports from one source (with the same doc comment) share one statement.
 */
function genModuleReExports(def: Pick<ComponentDocApi, "moduleExports">) {
  const statements: string[] = [];
  const namedGroups = new Map<string, { comment: string; from: string; specifiers: string[] }>();

  for (const prop of def.moduleExports) {
    if (prop.kind !== "re-export" || !prop.reExport) continue;
    const { from, imported } = prop.reExport;
    const comment = formatJsDocBlock(memberJsDocLines(prop.description, prop.deprecated, prop.tags));
    const name = formatKey(prop.name);

    if (imported === "*") {
      const clause = prop.name === "*" ? "*" : `* as ${name}`;
      statements.push(`${comment}\nexport ${clause} from ${JSON.stringify(from)};`);
      continue;
    }

    const key = `${from}\0${comment}`;
    let group = namedGroups.get(key);
    if (!group) {
      group = { comment, from, specifiers: [] };
      namedGroups.set(key, group);
      statements.push(key);
    }
    group.specifiers.push(imported === prop.name ? name : `${formatKey(imported)} as ${name}`);
  }

  return statements
    .map((statement) => {
      const group = namedGroups.get(statement);
      if (!group) return statement;
      return `${group.comment}\nexport { ${group.specifiers.join(", ")} } from ${JSON.stringify(group.from)};`;
    })
    .join("\n\n");
}

/**
 * One class member as a declaration signature, without the trailing `;`:
 * `static create<U>(value: U): Store<U>`, `readonly size: number`,
 * `constructor(initial: T)`. Shared by the `.d.ts` class body and the
 * Markdown members table.
 */
export function formatClassMemberSignature(member: ComponentClassMember): string {
  const modifiers = [
    member.static ? "static " : "",
    member.abstract ? "abstract " : "",
    member.readonly ? "readonly " : "",
  ].join("");
  const optional = member.optional ? "?" : "";
  if (member.kind === "property") return `${modifiers}${formatKey(member.name)}${optional}: ${member.type ?? ANY_TYPE}`;
  const params = formatParamList(member.params ?? []);
  if (member.kind === "constructor") return `constructor(${params})`;
  const typeParameters = member.typeParameters ? `<${member.typeParameters}>` : "";
  return `${modifiers}${formatKey(member.name)}${optional}${typeParameters}(${params}): ${member.returnType ?? ANY_TYPE}`;
}

/**
 * A module-script class as `export declare class`. A class exported under
 * another name (`export { Store as Alias }`, or a string name) is declared
 * under its own name, which its members may refer to, then exported by the
 * public one; `declared` keeps a class exported twice from being declared twice.
 */
function genModuleClassExport(prop: ComponentProp, declared: Set<string>): string {
  const localName = prop.localName ?? prop.name;
  const renamed = localName !== prop.name;
  const exportClause = `export { ${localName}${renamed ? ` as ${formatKey(prop.name)}` : ""} };`;
  if (declared.has(localName)) return exportClause;
  declared.add(localName);

  const typeParameters = prop.typeParameters ? `<${prop.typeParameters}>` : "";
  const members = (prop.members ?? [])
    .map((member) => {
      const comment = formatJsDocBlock(memberJsDocLines(member.description, member.deprecated, member.tags));
      return [comment, `${formatClassMemberSignature(member)};`].filter(Boolean).join("\n");
    })
    .join("\n\n");
  const heritage = `${prop.extends ? ` extends ${prop.extends}` : ""}${prop.implements?.length ? ` implements ${prop.implements.join(", ")}` : ""}`;
  const header = `${renamed ? "" : "export "}declare ${prop.abstract ? "abstract " : ""}class ${localName}${typeParameters}${heritage}`;
  const declaration = [
    formatJsDocBlock(memberJsDocLines(prop.description, prop.deprecated, prop.tags)),
    members ? `${header} {\n${members}\n}` : `${header} {}`,
    renamed ? exportClause : "",
  ];
  return `\n${declaration.filter(Boolean).join("\n")}`;
}

function genModuleExports(def: Pick<ComponentDocApi, "moduleExports">) {
  const reExports = genModuleReExports(def);
  const declaredClasses = new Set<string>();
  const declarations = def.moduleExports
    .filter((prop) => prop.kind !== "re-export")
    .map((exported) => {
      if (exported.kind === "class") return genModuleClassExport(exported, declaredClasses);
      // `export { a as "some-name" }`: declare under a private identifier, then export it by the string name.
      const quoted = !IDENTIFIER_REGEX.test(exported.name);
      const prop = quoted ? { ...exported, name: privateExportName(exported.name) } : exported;
      let type_def: string;

      const arrowIndex = prop.type && FUNCTION_TYPE_START_REGEX.test(prop.type) ? indexOfTopLevelArrow(prop.type) : -1;
      const typeParameters = prop.typeParameters ? `<${prop.typeParameters}>` : "";

      if (prop.kind === "const" && arrowIndex === -1) {
        type_def = `export declare const ${prop.name}: ${prop.type || ANY_TYPE};\n`;
      } else if (prop.kind === "let") {
        // `export let` (and `var`, recorded as `let`): a live binding, even when it holds a function.
        type_def = `export declare let ${prop.name}: ${prop.type || ANY_TYPE};`;
      } else if (prop.params && prop.params.length > 0) {
        type_def = `export declare function ${prop.name}${typeParameters}(${formatParamList(prop.params)}): ${prop.returnType || ANY_TYPE};`;
      } else if (prop.returnType) {
        type_def = `export declare function ${prop.name}${typeParameters}(): ${prop.returnType};`;
      } else if (prop.type && arrowIndex !== -1) {
        // A function type expression (e.g. from `@type`) rewritten as a function declaration.
        const signature = prop.type.slice(0, arrowIndex).trimEnd();
        const returnType = prop.type.slice(arrowIndex + 2).trim();
        type_def = `export declare function ${prop.name}${signature}: ${returnType};`;
      } else {
        type_def = `export declare let ${prop.name}: ${prop.type || ANY_TYPE};`;
      }

      if (quoted) {
        type_def = `${type_def.replace(LEADING_EXPORT_REGEX, "").trimEnd()}\nexport { ${prop.name} as ${JSON.stringify(exported.name)} };`;
      }

      return `
      ${formatJsDocBlock(memberJsDocLines(prop.description, prop.deprecated, prop.tags))}
      ${type_def}`;
    })
    .join("\n");
  return [reExports, declarations].filter(Boolean).join("\n\n");
}

/** A module-private identifier for a string-named export (`"some-name"` -> `__export_some_name`). */
function privateExportName(name: string): string {
  return `__export_${name.replace(NON_IDENTIFIER_CHAR_REGEX, "_")}`;
}

const COMPONENT_SHELL_INLINE_WIDTH = 120;

function genComponentShell(def: {
  accessors: string;
  events: string;
  generic: string;
  genericProps: string;
  moduleName: string;
  slots: string;
}) {
  const name = def.moduleName === "default" ? "" : def.moduleName;
  const header = `export default class ${name}${def.generic} extends SvelteComponentTyped<`;
  const typeArgs = [def.genericProps, def.events, def.slots];

  if (def.accessors.trim() === "" && typeArgs.every((arg) => !arg.includes("\n"))) {
    const oneLiner = `${header}${typeArgs.join(", ")}> {}`;
    if (oneLiner.length <= COMPONENT_SHELL_INLINE_WIDTH) return oneLiner;
  }

  return `${header}
      ${def.genericProps},
      ${def.events},
      ${def.slots}
    > {
      ${def.accessors}
    }`;
}

export interface WriteTsDefinitionOptions {
  /**
   * `"class"` (default) extends the deprecated `SvelteComponentTyped`.
   * `"component"` emits `declare const X: Component<Props, Exports, Bindings>`
   * instead, for Svelte 5+ consumers. Generic components and components with
   * events get a per-component interface instead, since a `declare const`
   * can't carry a generic type parameter and `Component` has no events slot.
   */
  format?: "class" | "component";
}

export function propsTypeName(moduleName: string): string {
  return `${moduleName}Props`;
}

export function exportsTypeName(moduleName: string): string {
  return `${moduleName}Exports`;
}

export function pickEmitOptions(options: WriteTsDefinitionOptions): WriteTsDefinitionOptions {
  return {
    format: options.format,
  };
}

/**
 * Defaults for `pickEmitOptions` fields. `serializeEmitOptions` iterates the picked
 * object rather than re-listing names, so the cache key can't silently miss a field.
 */
const EMIT_OPTION_DEFAULTS: Record<string, unknown> = {
  format: "class",
};

/** Generated-text cache key; defaults applied so `{}` and `{ format: "class" }` match. */
export function serializeEmitOptions(options: WriteTsDefinitionOptions | undefined): string {
  const picked = pickEmitOptions(options ?? {});
  const withDefaults: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(picked)) {
    withDefaults[key] = value ?? EMIT_OPTION_DEFAULTS[key];
  }
  return JSON.stringify(withDefaults);
}

export function writeTsDefinition(component: ComponentDocApi, options?: WriteTsDefinitionOptions) {
  const typeScriptMetadata = getParsedComponentTypeScriptMetadata(component);
  const {
    moduleName,
    typedefs,
    generics,
    props,
    moduleExports,
    slots,
    events,
    rest_props,
    extends: _extends,
    componentComment,
    contexts,
  } = component;

  const useComponentFormat = options?.format === "component";
  const isGenericComponent = generics !== null;

  const { props_name, prop_def, elementsImport } = genPropDef({
    moduleName,
    props,
    rest_props,
    extends: _extends,
    generics,
    slots,
    canonicalPropNames: new Set(typeScriptMetadata?.canonicalPropNames ?? []),
    canonicalPropsType: typeScriptMetadata?.canonicalPropsType,
  });

  const generic = generics ? `<${generics[1]}>` : "";
  const genericProps = generics ? `${props_name}<${generics[0]}>` : props_name;
  // An event detail can use the component's generics, so `$Events` takes them too.
  const eventsDef =
    useComponentFormat && events.length > 0 ? `type $Events${generic} = ${genEventDef({ events })};` : "";
  const eventsRef = generics ? `$Events<${generics[0]}>` : "$Events";
  const useComponentInterface = useComponentFormat && (isGenericComponent || eventsDef !== "");
  const moduleExportsDef = genModuleExports({ moduleExports });
  const typeDefs = getTypeDefs({ typedefs });
  const contextDefs = getContextDefs({ contexts, generics });
  const preservedTypeImports = (typeScriptMetadata?.typeImportStatements ?? []).join("\n");
  const preservedLocalTypeDeclarations = [
    ...(typeScriptMetadata?.localTypeDeclarations ?? []),
    ...(typeScriptMetadata?.moduleTypeDeclarations ?? []),
  ].join("\n\n");

  const { exports_ref, exports_def } = useComponentFormat
    ? genExportsDef({ props, moduleName, generics })
    : { exports_ref: "", exports_def: "" };
  const bindings = useComponentFormat ? genBindingsUnion({ props }) : "";

  const snippetImportNeeded =
    !PRESERVED_SNIPPET_IMPORT_REGEX.test(preservedTypeImports) &&
    [prop_def, moduleExportsDef, typeDefs, contextDefs, preservedLocalTypeDeclarations, exports_def].some((section) =>
      SNIPPET_TYPE_REFERENCE_REGEX.test(section),
    );

  const componentTypeImport = useComponentFormat
    ? useComponentInterface
      ? `import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals${snippetImportNeeded ? ", Snippet" : ""} } from "svelte";`
      : `import type { Component${snippetImportNeeded ? ", Snippet" : ""} } from "svelte";`
    : `import { SvelteComponentTyped${snippetImportNeeded ? ", type Snippet" : ""} } from "svelte";`;

  const importSection = [
    componentTypeImport,
    elementsImport ? `import type { ${elementsImport} } from "svelte/elements";` : "",
    preservedTypeImports,
    genImports({ extends: _extends }),
  ]
    .filter(Boolean)
    .join("\n");

  const componentDeclaration = useComponentFormat
    ? useComponentInterface
      ? genComponentInterfaceDeclaration({
          moduleName,
          generic,
          propsRef: genericProps,
          exportsRef: exports_ref,
          bindings,
          ...(eventsDef ? { eventsRef } : {}),
        })
      : genComponentDeclaration({ moduleName, propsRef: genericProps, exportsRef: exports_ref, bindings })
    : genComponentShell({
        moduleName,
        generic,
        genericProps,
        events: genEventDef({ events }),
        slots: genSlotDef({ slots }),
        accessors: genAccessors({ props }),
      });

  const bodySection = [
    moduleExportsDef,
    typeDefs,
    preservedLocalTypeDeclarations,
    contextDefs,
    prop_def,
    exports_def,
    eventsDef,
    [genComponentComment({ componentComment }), componentDeclaration].filter(Boolean).join("\n"),
  ]
    .map((section) => section.trim())
    .filter(Boolean)
    .join("\n\n");

  return formatGeneratedTypeScript([importSection, bodySection].filter(Boolean).join("\n\n"));
}
