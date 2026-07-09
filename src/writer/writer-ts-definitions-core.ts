import type { DeprecatedValue } from "../ComponentParser";
import { getParsedComponentTypeScriptMetadata } from "../parsed-component-metadata";
import { splitTopLevelCommas } from "../parser/generics";
import type { ComponentDocApi } from "../plugin";
import { formatGeneratedTypeScript } from "./format-generated-ts";

const ANY_TYPE = "any";
const EMPTY_STR = "";

/** Svelte 4 rejects `{}`; use `Record<string, any>` for empty events. */
const EMPTY_EVENTS = "Record<string, any>";

/** Avoids banned `{}` type; use `Record<string, never>` for empty objects. */
const EMPTY_OBJECT = "Record<string, never>";

const CLAMP_KEY_REGEX = /(-|\s+|:)/;
const QUOTE_REGEX = /("|')/;
const CUSTOM_EVENT_REGEX = /CustomEvent/;
const COMPONENT_NAME_REGEX = /^[A-Z]/;
const NEWLINE_REGEX = /\n/;
const FUNCTION_TYPE_REGEX = /=>/;
const DESCRIPTION_DEFAULT_TAG_REGEX = /(?:^|\n)@default\b/;
const NEWLINE_TO_COMMENT_REGEX = /\n/g;
const WHITESPACE_REGEX = /\s+/g;
const SNIPPET_TYPE_REFERENCE_REGEX = /(^|[^.\w])Snippet(?:\s*<|\b)/;
const PRESERVED_SNIPPET_IMPORT_REGEX = /import\s+type\s+[^;]*\bSnippet\b[^;]*from\s+"svelte";/;
// Matches regex metacharacters that must be escaped before interpolating
// a user-authored generic name into a RegExp.
const REGEX_METACHARS = /[.*+?^${}()|[\]\\]/g;
const LEADING_CONST_MODIFIER_REGEX = /^const\s+/;

/**
 * Strips a leading `const` type-parameter modifier from a single generic
 * constraint (e.g. `"const T extends readonly string[]"` -> `"T extends
 * readonly string[]"`). `const` is only legal on function, method, and class
 * type parameters (TS1277) - a `type X<const T> = ...` alias declaration is a
 * syntax error, even though `class X<const T>` is fine. Callers that build a
 * `type`/`export type` declaration must strip it; callers that build a class
 * declaration or interface method/construct signature must not.
 */
function stripConstModifierForTypeAlias(constraint: string): string {
  return constraint.replace(LEADING_CONST_MODIFIER_REGEX, "");
}

function formatDescriptionForComment(description: string | undefined): string | undefined {
  if (!description) return undefined;
  return description.replace(NEWLINE_TO_COMMENT_REGEX, "\n* ");
}

function formatSingleLineComment(description: string | undefined): string {
  if (!description) return "";
  return `/** ${description} */`;
}

function formatMultiLineComment(description: string | undefined): string {
  if (!description) return "";
  return `/**\n * ${description.replace(NEWLINE_TO_COMMENT_REGEX, "\n * ")}\n */`;
}

/**
 * Builds the `@deprecated` JSDoc line(s) for a symbol, or undefined when the
 * symbol is not deprecated. `true` emits a bare `@deprecated`; a string appends
 * the message.
 */
function formatDeprecatedJsDocLine(deprecated: DeprecatedValue | undefined): string | undefined {
  if (deprecated === undefined) return undefined;
  return deprecated === true ? "@deprecated" : `@deprecated ${deprecated}`;
}

/**
 * Builds a `* @deprecated ...\n` comment fragment for `wrapCommentInJSDoc`, or
 * undefined when the symbol is not deprecated.
 */
function deprecatedCommentLine(deprecated: DeprecatedValue | undefined): string | undefined {
  const line = formatDeprecatedJsDocLine(deprecated);
  if (line === undefined) return undefined;
  return `* ${line.replace(NEWLINE_TO_COMMENT_REGEX, "\n* ")}\n`;
}

function expandJsDocTagContent(name: string, body: string): string[] {
  if (!body) return [`@${name}`];
  if (!body.includes("\n")) return [`@${name} ${body}`];
  return [`@${name}`, ...body.split("\n")];
}

function expandJsDocTagLines(tags: Array<{ name: string; body: string }> | undefined): string[] {
  const lines: string[] = [];
  for (const { name, body } of tags ?? []) {
    lines.push(...expandJsDocTagContent(name, body));
  }
  return lines;
}

function formatSlotJsDoc(
  description: string | undefined,
  tags: Array<{ name: string; body: string }> | undefined,
  deprecated?: DeprecatedValue,
): string {
  const deprecatedLine = formatDeprecatedJsDocLine(deprecated);
  const tagLines = expandJsDocTagLines(tags);
  const hasTags = tagLines.length > 0;
  if (!description && !hasTags && !deprecatedLine) return "";
  if (!hasTags && !deprecatedLine) {
    return description?.includes("\n") ? formatMultiLineComment(description) : formatSingleLineComment(description);
  }
  const lines: string[] = [];
  if (description) lines.push(...description.split("\n"));
  lines.push(...tagLines);
  if (deprecatedLine) lines.push(...deprecatedLine.split("\n"));
  return `/**\n * ${lines.join("\n * ")}\n */`;
}

function formatTagCommentLines(tags?: Array<{ name: string; body: string }>): string {
  const tagLines = expandJsDocTagLines(tags);
  if (tagLines.length === 0) return "";
  return tagLines.map((line) => `* ${line}\n`).join("");
}

export function formatTsProps(props?: string) {
  if (props === undefined) return ANY_TYPE;
  return `${props}\n`;
}

export function getTypeDefs(def: Pick<ComponentDocApi, "typedefs">) {
  if (def.typedefs.length === 0) return EMPTY_STR;
  return def.typedefs
    .map((typedef) => {
      const typedefComment = typedef.description ? `${formatMultiLineComment(typedef.description)}\n` : "";
      return `${typedefComment}export ${typedef.ts}`;
    })
    .join("\n\n");
}

/**
 * Returns whether a property type references a generic type parameter by name,
 * matching on word boundaries so `Value` doesn't match `ValueType`.
 */
function referencesGeneric(propType: string, name: string): boolean {
  const escapedName = name.replace(REGEX_METACHARS, "\\$&");
  return new RegExp(`\\b${escapedName}\\b`).test(propType);
}

/**
 * Pairs each `@template`/`generics` name with its full constraint declaration
 * (e.g. `Row extends DataTableRow = DataTableRow`), splitting only at
 * top-level commas since a constraint may itself contain commas (e.g.
 * `Record<string, any>`).
 */
function getGenericParams(generics: ComponentDocApi["generics"]): Array<{ name: string; constraint: string }> {
  if (generics === null) return [];
  return generics[0].split(",").map((name, index) => ({
    name: name.trim(),
    constraint: (splitTopLevelCommas(generics[1] ?? "")[index] ?? name).trim(),
  }));
}

/**
 * Computes the generic parameter list a standalone type declaration needs
 * to parameterize with, given the text of its body: only the generics it
 * actually references, in declaration order. Returns the full constraint
 * form (for the declaration site, e.g. `<Row extends Foo = Bar>`) and the
 * name-only form (for reference sites, e.g. `<Row>`).
 */
function computeReferencedGenerics(generics: ComponentDocApi["generics"], text: string) {
  const referenced = getGenericParams(generics).filter(({ name }) => referencesGeneric(text, name));

  if (referenced.length === 0) return { declSuffix: EMPTY_STR, refSuffix: EMPTY_STR };

  return {
    declSuffix: `<${referenced.map(({ constraint }) => stripConstModifierForTypeAlias(constraint)).join(", ")}>`,
    refSuffix: `<${referenced.map(({ name }) => name).join(", ")}>`,
  };
}

/**
 * Exported context type definitions for a component.
 *
 * @param def - Component documentation containing contexts and generics
 * @returns TypeScript type definition string, or empty string if no contexts
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
  if (!def.contexts || def.contexts.length === 0) return EMPTY_STR;

  /**
   * Pair each generic name with its constraint declaration so the context type
   * can be parameterized with only the generics it actually references.
   *
   * A component may declare multiple `@template`s, in which case `generics` holds
   * comma-joined names (`"Value,Icon"`) and constraints
   * (`"Value extends string = string, Icon = any"`). Constraints may themselves
   * contain commas (e.g. `Record<string, any>`), so names drive the pairing and
   * constraints are split only at top-level commas.
   */
  const genericParams =
    def.generics === null
      ? []
      : def.generics[0].split(",").map((name, index) => ({
          name: name.trim(),
          constraint: (splitTopLevelCommas(def.generics?.[1] ?? "")[index] ?? name).trim(),
        }));

  return def.contexts
    .map((context) => {
      const props = context.properties
        .map((prop) => {
          const comment = prop.description ? `${formatSingleLineComment(prop.description)}\n  ` : "";
          const optional = prop.optional ? "?" : "";
          return `${comment}${prop.name}${optional}: ${prop.type};`;
        })
        .join("\n  ");

      const contextComment = context.description ? `${formatMultiLineComment(context.description)}\n` : "";

      /**
       * Parameterize the context type with the generics its properties reference,
       * preserving declaration order (e.g. `ModalContext<Value, Icon>`). Generics
       * that aren't referenced are omitted so the type stays as narrow as possible.
       */
      const referencedConstraints = genericParams
        .filter(({ name }) => context.properties.some((prop) => referencesGeneric(prop.type, name)))
        .map(({ constraint }) => constraint);

      const genericSuffix =
        referencedConstraints.length > 0
          ? `<${referencedConstraints.map(stripConstModifierForTypeAlias).join(", ")}>`
          : "";

      /**
       * Use Record<string, never> for empty context objects instead of {}.
       * This complies with Biome linter rules and Svelte 4 compatibility.
       */
      if (context.properties.length === 0) {
        return `${contextComment}export type ${context.typeName} = Record<string, never>;`;
      }

      return `${contextComment}export type ${context.typeName}${genericSuffix} = {\n  ${props}\n};`;
    })
    .join("\n\n");
}

function clampKey(key: string) {
  if (CLAMP_KEY_REGEX.test(key)) {
    return QUOTE_REGEX.test(key) ? key : `"${key}"`;
  }

  return key;
}

function addCommentLine(value: string | boolean | undefined, returnValue?: string) {
  if (!value) return undefined;
  return `* ${returnValue || value}\n`;
}

/**
 * Creates a prop comment string from a description and optional deprecation.
 */
function createPropComment(
  description: string | undefined,
  deprecated?: DeprecatedValue,
  tags?: Array<{ name: string; body: string }>,
): string {
  return [
    addCommentLine(formatDescriptionForComment(description)),
    deprecatedCommentLine(deprecated),
    formatTagCommentLines(tags),
  ]
    .filter(Boolean)
    .join("");
}

/**
 * Wraps comment lines in JSDoc format if comments exist.
 */
function wrapCommentInJSDoc(commentLines: string): string {
  return commentLines.length > 0 ? `/**\n${commentLines}*/` : EMPTY_STR;
}

/**
 * Generates the `$Props` type for a component.
 *
 * @param def - Component documentation containing props, slots, rest_props, etc.
 * @returns An object with the props type name and the generated type definition
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
    /**
     * Legacy component events to render as `on<name>?: (event: Type) => void`
     * callback props. Only passed for `"component"` format on legacy
     * components; runes components already have callback props declared
     * as regular props.
     */
    events?: ComponentDocApi["events"];
  },
) {
  /**
   * Collect existing prop names to avoid conflicts with snippet props.
   * Snippet props are generated for slots, but shouldn't conflict with
   * actual component props.
   */
  const existingPropNames = new Set([
    ...def.props.filter((prop) => !prop.isFunctionDeclaration && prop.kind !== "const").map((prop) => prop.name),
    ...Array.from(def.canonicalPropNames ?? []),
  ]);

  const initial_props = def.props
    .filter((prop) => !prop.isFunctionDeclaration && prop.kind !== "const")
    .map((prop) => {
      let defaultValue = prop.value;

      if (typeof prop.value === "string") {
        defaultValue = prop.value.replace(WHITESPACE_REGEX, " ");
      }

      if (prop.value === undefined) {
        defaultValue = "undefined";
      }

      const descriptionHasDefault = DESCRIPTION_DEFAULT_TAG_REGEX.test(prop.description ?? "");

      const prop_comments = [
        createPropComment(prop.description, prop.deprecated, prop.tags),
        addCommentLine(prop.constant, "@constant"),
        /**
         * Don't add @default for functions - they don't have meaningful default values.
         * Function props are callbacks, not values with defaults.
         * Also skip if the description already contains an explicit @default annotation.
         */
        prop.isFunction || descriptionHasDefault ? null : `* @default ${defaultValue}\n`,
      ]
        .filter(Boolean)
        .join("");

      const prop_value = prop.constant && !prop.isFunction ? prop.value : prop.type;

      return `
      ${wrapCommentInJSDoc(prop_comments)}
      ${prop.name}${prop.isRequired ? "" : "?"}: ${prop_value};`;
    });

  const extra_initial_props = def.canonicalPropsType
    ? initial_props.filter((_, index) => {
        const prop = def.props.filter((item) => !item.isFunctionDeclaration && item.kind !== "const")[index];
        return prop ? !(def.canonicalPropNames?.has(prop.name) ?? false) : true;
      })
    : initial_props;

  /**
   * Generate snippet props for named slots (Svelte 5 compatibility).
   * Svelte 5 uses snippet props to type-check slot content. Skip default slots
   * and slots that conflict with existing prop names to avoid type conflicts.
   */
  const named_snippet_props = (def.slots || [])
    .filter(
      (slot): slot is typeof slot & { name: string } =>
        !slot.default && slot.name != null && !existingPropNames.has(slot.name),
    )
    .map((slot) => {
      const slotName = slot.name;
      const key = clampKey(slotName);
      const slotComment = formatSlotJsDoc(slot.description, slot.tags, slot.deprecated);
      const description = slotComment ? `${slotComment}\n      ` : "";
      /**
       * Use Snippet-compatible type: (this: void, ...args: [Props]) => void for slots with props
       * or (this: void) => void for slots without props.
       * The `this: void` parameter ensures the snippet function cannot access `this`.
       */
      const hasSlotProps = slot.slot_props && slot.slot_props !== "Record<string, never>";
      const snippetType = hasSlotProps ? `(this: void, ...args: [${slot.slot_props}]) => void` : "(this: void) => void";
      return `
      ${description}${key}?: ${snippetType};`;
    });

  /**
   * Generate children snippet prop for default slot (Svelte 5 compatibility).
   * The default slot is accessed via the `children` prop in Svelte 5's snippet API.
   */
  const default_slot = (def.slots || []).find((slot) => slot.default || slot.name === null);
  const children_snippet_prop =
    default_slot && !existingPropNames.has("children")
      ? (() => {
          const defaultSlotComment = formatSlotJsDoc(
            default_slot.description,
            default_slot.tags,
            default_slot.deprecated,
          );
          const description = defaultSlotComment ? `${defaultSlotComment}\n      ` : "";
          const hasSlotProps = default_slot.slot_props && default_slot.slot_props !== "Record<string, never>";
          const snippetType = hasSlotProps
            ? `(this: void, ...args: [${default_slot.slot_props}]) => void`
            : "(this: void) => void";
          return `
      ${description}children?: ${snippetType};`;
        })()
      : "";

  const event_callback_props = def.events ? genEventCallbackProps({ events: def.events }, existingPropNames) : [];

  const snippet_props = [...named_snippet_props, children_snippet_prop, ...event_callback_props].filter(Boolean);

  const props = [...extra_initial_props, ...snippet_props].join("\n");

  const props_name = `${def.moduleName}Props`;

  let prop_def = EMPTY_STR;

  /**
   * Full constraints for type definitions (e.g., `type $Props<T extends Foo = Bar>`).
   * Includes the full generic constraint with extends and default.
   */
  const genericsName = def.generics
    ? `<${splitTopLevelCommas(def.generics[1])
        .map((constraint) => stripConstModifierForTypeAlias(constraint.trim()))
        .join(", ")}>`
    : "";
  /**
   * Names only for type references (e.g., `keyof $Props<T>`).
   * Just the generic parameter name without constraints.
   */
  const genericsNameRef = def.generics ? `<${def.generics[0]}>` : "";

  const basePropsDef = def.canonicalPropsType
    ? `
    type $Props${genericsName} = ${def.canonicalPropsType}${
      props.trim() === ""
        ? ""
        : ` & {${props}
    }`
    };
  `
    : `
    type $Props${genericsName} = {
      ${props}
    };
  `;

  if (def.rest_props?.type === "Element") {
    let extend_tag_map: string;

    /**
     * Handle svelte:element specially.
     * svelte:element can have either a static tag (thisValue) or dynamic tag.
     */
    if (def.rest_props.name === "svelte:element") {
      /**
       * If thisValue is provided (hardcoded element tag), use that element type.
       * Otherwise, fallback to HTMLElement for dynamic this attribute.
       */
      if (def.rest_props.thisValue) {
        extend_tag_map = `SvelteHTMLElements["${def.rest_props.thisValue}"]`;
      } else {
        /**
         * Dynamic this attribute - use generic HTMLElement.
         * Since we don't know the element type at compile time, use the base type.
         */
        extend_tag_map = "HTMLAttributes<HTMLElement>";
      }
    } else {
      extend_tag_map = def.rest_props.name
        .split("|")
        .map((name) => {
          const element = name.trim();
          return `SvelteHTMLElements["${element}"]`;
        })
        .join(" & ");
    }

    /**
     * Preserve `data-*` attrs for Svelte 3 HTML-extending components.
     * @see https://github.com/sveltejs/language-tools/issues/1825
     */

    /**
     * biome-ignore lint/suspicious/noTemplateCurlyInString: type generation
     * Template literal is required for TypeScript's template literal type syntax.
     */
    const dataAttributes = "[key: `data-${string}`]: unknown;";

    /**
     * Generate JSDoc comment for $RestProps if description is provided.
     * Use multiline format when description contains newlines.
     */
    const restPropsComment = def.rest_props.description
      ? def.rest_props.description.includes("\n")
        ? `${formatMultiLineComment(def.rest_props.description)}\n    `
        : `${formatSingleLineComment(def.rest_props.description)}\n    `
      : "";

    /**
     * When both `@extends` and `@restProps` are present, merge all three type sources:
     * 1. Rest props from element types (SvelteHTMLElements)
     * 2. Component props ($Props)
     * 3. Extended interface (`@extends`)
     */
    if (def.extends === undefined) {
      prop_def = `
    ${restPropsComment}${extend_tag_map ? `type $RestProps = ${extend_tag_map};\n` : ""}
    ${
      def.canonicalPropsType
        ? `type $Props${genericsName} = (${def.canonicalPropsType}) & {${props}

      ${dataAttributes}
    };`
        : `type $Props${genericsName} = {
      ${props}

      ${dataAttributes}
    };`
    }

    export type ${props_name}${genericsName} = Omit<$RestProps, keyof $Props${genericsNameRef}> & $Props${genericsNameRef};
  `;
    } else {
      prop_def = `
    ${restPropsComment}${extend_tag_map ? `type $RestProps = ${extend_tag_map};\n` : ""}
    ${
      def.canonicalPropsType
        ? `type $Props${genericsName} = (${def.canonicalPropsType}) & {${props}

      ${dataAttributes}
    };`
        : `type $Props${genericsName} = {
      ${props}

      ${dataAttributes}
    };`
    }

    export type ${props_name}${genericsName} = Omit<$RestProps, keyof ($Props${genericsNameRef} & ${def.extends.interface})> & $Props${genericsNameRef} & ${def.extends.interface};
  `;
    }
  } else {
    /**
     * Use EMPTY_OBJECT when there are no props and no extends.
     * This ensures we don't generate `{}` which is incompatible with Svelte 4
     * and violates Biome linter rules.
     */
    if (props.trim() === "" && def.extends === undefined && !def.canonicalPropsType) {
      prop_def = `
    export type ${props_name}${genericsName} = ${EMPTY_OBJECT};
  `;
    } else if (def.canonicalPropsType) {
      prop_def = `
    ${basePropsDef}
    export type ${props_name}${genericsName} = ${def.extends === undefined ? "" : `${def.extends.interface} & `}$Props${genericsNameRef};
  `;
    } else {
      prop_def = `
    export type ${props_name}${genericsName} = ${def.extends === undefined ? "" : `${def.extends.interface} & `} {
      ${props}
    };
  `;
    }
  }

  return {
    props_name,
    prop_def,
  };
}

function genSlotDef(def: Pick<ComponentDocApi, "slots">) {
  if (def.slots.length === 0) return EMPTY_OBJECT;

  const slotDefs = def.slots
    .map(({ name, slot_props, ...rest }) => {
      const key = rest.default || name === null ? "default" : clampKey(name ?? "");
      const slotDefComment = formatSlotJsDoc(rest.description, rest.tags, rest.deprecated);
      const description = slotDefComment ? `${slotDefComment}\n` : "";
      return `${description}${clampKey(key)}: ${formatTsProps(slot_props)};`;
    })
    .join("\n");

  // Force multiline when count > 1 (matches interface body formatting).
  return def.slots.length === 1 ? `{${slotDefs}}` : `{\n${slotDefs}\n}`;
}

const mapEvent = () => "WindowEventMap";

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

function createDispatchedEventType(detail: string = ANY_TYPE) {
  if (CUSTOM_EVENT_REGEX.test(detail)) return detail;
  return `CustomEvent<${detail}>`;
}

function isStandardDomEvent(eventName: string): boolean {
  return STANDARD_DOM_EVENTS.has(eventName);
}

/**
 * Computes the TypeScript type for a single component event, shared between
 * the `{ event: Type }` map (`class` format) and the `on<name>` callback prop
 * type (`component` format).
 */
function computeEventTypeString(event: ComponentDocApi["events"][number]): string {
  switch (event.type) {
    case "dispatched":
      return createDispatchedEventType(event.detail);
    case "forwarded": {
      const elementName = event.element;
      const isComponent = elementName && COMPONENT_NAME_REGEX.test(elementName);
      const isStandardEvent = !isComponent || isStandardDomEvent(event.name);

      const hasExplicitDetail =
        event.detail !== undefined && event.detail !== "undefined" && !(event.detail === "null" && isStandardEvent);
      const hasExplicitNullForCustomComponent = event.detail === "null" && !isStandardEvent;

      if (hasExplicitDetail || hasExplicitNullForCustomComponent) {
        return createDispatchedEventType(event.detail);
      } else if (isStandardEvent) {
        return `${mapEvent()}["${event.name}"]`;
      } else {
        return createDispatchedEventType();
      }
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
      let description = "";
      const eventComment = formatSlotJsDoc(event.description, event.tags, event.deprecated);
      if (eventComment) {
        description = `${eventComment}\n`;
      }

      return `${description}${clampKey(event.name)}: ${computeEventTypeString(event)};\n`;
    })
    .join("");

  // Force multiline when count > 1 (matches interface body formatting).
  return def.events.length === 1 ? `{${events_map}}` : `{\n${events_map}}`;
}

/**
 * Generates `on<name>?: (event: Type) => void;` prop entries for legacy
 * (non-runes) components in `"component"` format. Runes components already
 * declare callback props (e.g. `onclick`) as regular props, so this is only
 * called for legacy components. Skips names that collide with an existing prop.
 */
function genEventCallbackProps(def: Pick<ComponentDocApi, "events">, existingPropNames: Set<string>): string[] {
  return def.events
    .map((event) => {
      const propName = `on${event.name}`;
      if (existingPropNames.has(propName)) return undefined;

      let description = "";
      const eventComment = formatSlotJsDoc(event.description, event.tags, event.deprecated);
      if (eventComment) {
        description = `${eventComment}\n      `;
      }

      return `
      ${description}${clampKey(propName)}?: (event: ${computeEventTypeString(event)}) => void;`;
    })
    .filter((entry): entry is string => entry !== undefined);
}

/**
 * Generates a function type string from a prop's type, params, and returnType.
 * Priority: `@type` tag > `@param`/`@returns` tags > fallback to prop.type
 */
function generateFunctionType(prop: {
  type?: string;
  params?: Array<{ name: string; type: string; optional?: boolean }>;
  returnType?: string;
}): string {
  const isDefaultFunctionType = prop.type === "() => any";

  if (prop.type && FUNCTION_TYPE_REGEX.test(prop.type) && !isDefaultFunctionType) {
    return prop.type;
  } else if (prop.params && prop.params.length > 0) {
    const paramStrings = prop.params.map((param) => {
      const optional = param.optional ? "?" : "";
      return `${param.name}${optional}: ${param.type}`;
    });
    const paramsString = paramStrings.join(", ");
    const returnType = prop.returnType || ANY_TYPE;
    return `(${paramsString}) => ${returnType}`;
  } else if (prop.returnType) {
    return `() => ${prop.returnType}`;
  } else {
    return prop.type || ANY_TYPE;
  }
}

function genAccessors(def: Pick<ComponentDocApi, "props">) {
  return def.props
    .filter((prop) => prop.isFunctionDeclaration || prop.kind === "const")
    .map((prop) => {
      const prop_comments = createPropComment(prop.description, prop.deprecated, prop.tags);

      const functionType = generateFunctionType(prop);

      return `
    ${wrapCommentInJSDoc(prop_comments)}
    ${prop.name}: ${functionType};`;
    })
    .join("\n");
}

/**
 * Generates the `Exports` type for `"component"` format: the same accessor
 * props (exported `function`/`const` members) that render as class members
 * in `"class"` format, rendered instead as an object type's members.
 *
 * The declaration is parameterized only with the generics its members
 * actually reference (same convention as {@link getContextDefs}), and
 * `exports_ref` is the corresponding reference form (e.g. `FooExports<Row>`)
 * for use at the call site.
 */
function genExportsDef(def: Pick<ComponentDocApi, "props" | "moduleName" | "generics">) {
  const exports_name = `${def.moduleName}Exports`;
  const accessors = genAccessors({ props: def.props });

  if (accessors.trim() === "") {
    return { exports_name, exports_ref: exports_name, exports_def: `export type ${exports_name} = ${EMPTY_OBJECT};` };
  }

  const { declSuffix, refSuffix } = computeReferencedGenerics(def.generics, accessors);

  return {
    exports_name,
    exports_ref: `${exports_name}${refSuffix}`,
    exports_def: `export type ${exports_name}${declSuffix} = {${accessors}\n  };`,
  };
}

/**
 * Generates the `Bindings` union for `"component"` format: a union of string
 * literals for props declared with `$bindable(...)` (runes) or marked
 * `@bindable writable` (legacy), or `""` when the component declares none.
 */
function genBindingsUnion(def: Pick<ComponentDocApi, "props">): string {
  const bindableNames = def.props
    .filter((prop) => prop.bindable === true || prop.binding === "writable")
    .map((prop) => `"${prop.name}"`);

  return bindableNames.length === 0 ? EMPTY_STR : bindableNames.join(" | ");
}

/**
 * Generates the `declare const <Name>: Component<Props, Exports, Bindings>;`
 * shell for `"component"` format, in place of the `SvelteComponentTyped` class.
 * `$$Component` stands in for the identifier when `moduleName` is "default"
 * (an anonymous default export), since `declare const` requires a name.
 */
function genComponentDeclaration(def: { moduleName: string; propsRef: string; exportsRef: string; bindings: string }) {
  const identifier = def.moduleName === "default" ? "$$Component" : def.moduleName;
  const bindingsLiteral = def.bindings === EMPTY_STR ? '""' : def.bindings;

  return `declare const ${identifier}: Component<
      ${def.propsRef},
      ${def.exportsRef},
      ${bindingsLiteral}
    >;
    export default ${identifier};`;
}

/**
 * Generates the `"component"` format shell for a GENERIC component. A
 * `declare const` can't itself carry a generic type parameter the way a
 * class can, so instead of `Component<Props, Exports, Bindings>` this emits
 * a per-component interface with two generic signatures instead:
 *
 * - a `(internals, props) => {...} & Exports` call signature, mirroring the
 *   `Component` interface's own shape, for consumers that call/mount the
 *   component directly;
 * - a `new (options) => SvelteComponent<...> & Exports` construct signature,
 *   because the Svelte language server's template checker resolves generic
 *   inference for `<Comp prop={...} />` usage through `new`, not the call
 *   signature - confirmed empirically against `@sveltejs/package`'s own
 *   generated output, which emits both for the same reason. Omitting it
 *   silently breaks per-usage inference: attributes type-check against the
 *   generic's default/constraint instead of the actual usage, which is
 *   exactly the "silent wrong types" failure this format must avoid.
 *
 * This is the one place `"component"` format still touches a legacy type
 * (`SvelteComponent`/`ComponentConstructorOptions`, not the deprecated
 * `SvelteComponentTyped`), because it's the only way to get correct
 * generic inference for template usage.
 */
function genGenericComponentDeclaration(def: {
  moduleName: string;
  generic: string;
  propsRef: string;
  exportsRef: string;
  bindings: string;
}) {
  const identifier = def.moduleName === "default" ? "$$Component" : def.moduleName;
  const interfaceName = `${identifier}Component`;
  const bindingsLiteral = def.bindings === EMPTY_STR ? '""' : def.bindings;

  return `interface ${interfaceName} {
      new ${def.generic}(
        options: ComponentConstructorOptions<${def.propsRef}>
      ): SvelteComponent<${def.propsRef}> & ${def.exportsRef};
      ${def.generic}(
        this: void,
        internals: ComponentInternals,
        props: ${def.propsRef}
      ): {
        $on?(type: string, callback: (e: any) => void): () => void;
        $set?(props: Partial<${def.propsRef}>): void;
      } & ${def.exportsRef};
      element?: typeof HTMLElement;
      z_$$bindings?: ${bindingsLiteral};
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
  return `/*${def.componentComment
    .split("\n")
    .map((line) => `* ${line}`)
    .join("\n")}\n*/`;
}

function genModuleExports(def: Pick<ComponentDocApi, "moduleExports">) {
  return def.moduleExports
    .map((prop) => {
      const prop_comments = createPropComment(prop.description, prop.deprecated, prop.tags);

      let type_def: string;

      const is_function = prop.type && FUNCTION_TYPE_REGEX.test(prop.type);
      const isDefaultFunctionType = prop.type === "() => any";

      /**
       * Check for const exports first (but only if not a function).
       * Const exports from script context="module" should use `declare const`.
       */
      if (prop.kind === "const" && !is_function) {
        /**
         * For const exports from script context="module", use declare const instead of type.
         * This matches how TypeScript handles const declarations in .d.ts files.
         */
        type_def = `export declare const ${prop.name}: ${prop.type || ANY_TYPE};\n`;
      } else if (prop.params && prop.params.length > 0) {
        const paramStrings = prop.params.map((param) => {
          const optional = param.optional ? "?" : "";
          return `${param.name}${optional}: ${param.type}`;
        });
        const paramsString = paramStrings.join(", ");
        const returnType = prop.returnType || ANY_TYPE;
        type_def = `export declare function ${prop.name}(${paramsString}): ${returnType};`;
      } else if (prop.returnType) {
        type_def = `export declare function ${prop.name}(): ${prop.returnType};`;
      } else if (is_function && prop.type && !isDefaultFunctionType) {
        /**
         * `@type` tag provides a custom function signature.
         * Convert function type to function declaration format.
         */
        const [first, second, ...rest] = prop.type.split("=>");
        const rest_type = rest.map((item) => ` => ${item.trim()}`).join("");
        type_def = `export declare function ${prop.name}${first.trimEnd()}: ${second.trim()}${rest_type};`;
      } else if (is_function && prop.type) {
        /**
         * Fall back to existing function type handling (including default function type).
         * Convert the function type expression to a function declaration.
         */
        const [first, second, ...rest] = prop.type.split("=>");
        const rest_type = rest.map((item) => ` => ${item.trim()}`).join("");
        type_def = `export declare function ${prop.name}${first.trimEnd()}: ${second.trim()}${rest_type};`;
      } else if (prop.kind === "const") {
        /**
         * Const exports that are functions (shouldn't happen, but handle gracefully).
         * Treat as const with function type.
         */
        type_def = `export declare const ${prop.name}: ${prop.type || ANY_TYPE};\n`;
      } else {
        /**
         * Default: export as type.
         * For non-function, non-const exports, use type alias.
         */
        type_def = `export type ${prop.name} = ${prop.type || ANY_TYPE};`;
      }

      return `
      ${wrapCommentInJSDoc(prop_comments)}
      ${type_def}`;
    })
    .join("\n");
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
   * instead, for Svelte 5+ consumers. Generic components get a per-component
   * interface with a generic call signature instead of `Component<...>`
   * directly, since a `declare const` can't itself carry a generic type
   * parameter (see `genGenericComponentDeclaration`).
   */
  format?: "class" | "component";
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
    syntaxMode,
  } = component;

  const useComponentFormat = options?.format === "component";
  const isGenericComponent = generics !== null;

  const { props_name, prop_def } = genPropDef({
    moduleName,
    props,
    rest_props,
    extends: _extends,
    generics,
    slots,
    canonicalPropNames: new Set(typeScriptMetadata?.canonicalPropNames ?? []),
    canonicalPropsType: typeScriptMetadata?.canonicalPropsType,
    events: useComponentFormat && syntaxMode === "legacy" ? events : undefined,
  });

  const generic = generics ? `<${generics[1]}>` : "";
  const genericProps = generics ? `${props_name}<${generics[0]}>` : props_name;
  const moduleExportsDef = genModuleExports({ moduleExports });
  const typeDefs = getTypeDefs({ typedefs });
  const contextDefs = getContextDefs({ contexts, generics });
  const preservedTypeImports = (typeScriptMetadata?.typeImportStatements ?? []).join("\n");
  const preservedLocalTypeDeclarations = (typeScriptMetadata?.localTypeDeclarations ?? []).join("\n\n");

  const { exports_ref, exports_def } = useComponentFormat
    ? genExportsDef({ props, moduleName, generics })
    : { exports_ref: EMPTY_STR, exports_def: EMPTY_STR };
  const bindings = useComponentFormat ? genBindingsUnion({ props }) : EMPTY_STR;

  const snippetImportNeeded =
    !PRESERVED_SNIPPET_IMPORT_REGEX.test(preservedTypeImports) &&
    SNIPPET_TYPE_REFERENCE_REGEX.test(
      `${prop_def}\n${moduleExportsDef}\n${typeDefs}\n${contextDefs}\n${preservedLocalTypeDeclarations}\n${exports_def}`,
    );

  /**
   * Determine imports needed for rest_props.
   * SvelteHTMLElements is needed for regular elements and svelte:element with static tags.
   * HTMLAttributes is needed for dynamic svelte:element (no thisValue).
   */
  const needsSvelteHTMLElements =
    rest_props?.type === "Element" &&
    (rest_props.name !== "svelte:element" || (rest_props.name === "svelte:element" && rest_props.thisValue));
  const needsHTMLAttributes =
    rest_props?.type === "Element" && rest_props.name === "svelte:element" && !rest_props.thisValue;

  /**
   * Generic components can't use `Component<...>` directly (a `declare const`
   * can't carry its own generic type parameter), so they hand-roll an
   * interface instead (see `genGenericComponentDeclaration`). It needs
   * `SvelteComponent`/`ComponentConstructorOptions` for the `new` signature
   * template-checking depends on, plus `ComponentInternals` for the call
   * signature. Not `SvelteComponentTyped`, which stays avoided.
   */
  const componentTypeImport = useComponentFormat
    ? isGenericComponent
      ? `import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals${snippetImportNeeded ? ", Snippet" : ""} } from "svelte";`
      : `import type { Component${snippetImportNeeded ? ", Snippet" : ""} } from "svelte";`
    : `import { SvelteComponentTyped${snippetImportNeeded ? ", type Snippet" : ""} } from "svelte";`;

  const importSection = [
    componentTypeImport,
    needsSvelteHTMLElements ? `import type { SvelteHTMLElements } from "svelte/elements";` : "",
    needsHTMLAttributes ? `import type { HTMLAttributes } from "svelte/elements";` : "",
    preservedTypeImports,
    genImports({ extends: _extends }),
  ]
    .filter(Boolean)
    .join("\n");

  const componentDeclaration = useComponentFormat
    ? isGenericComponent
      ? genGenericComponentDeclaration({
          moduleName,
          generic,
          propsRef: genericProps,
          exportsRef: exports_ref,
          bindings,
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
    [genComponentComment({ componentComment }), componentDeclaration].filter(Boolean).join("\n"),
  ]
    .map((section) => section.trim())
    .filter(Boolean)
    .join("\n\n");

  return formatGeneratedTypeScript([importSection, bodySection].filter(Boolean).join("\n\n"));
}
