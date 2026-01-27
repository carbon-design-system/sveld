import type { ComponentDocApi } from "../rollup-plugin";

const ANY_TYPE = "any";
const EMPTY_STR = "";

/**
 * Empty events type definition.
 *
 * Svelte 4 is not compatible with `{}` type, so we use `Record<string, any>`
 * instead for empty event objects.
 */
const EMPTY_EVENTS = "Record<string, any>";

/**
 * Empty object type definition.
 *
 * Avoids `{}` type per Biome linter rule `noBannedTypes`.
 * Uses `Record<string, never>` to represent an empty object type.
 */
const EMPTY_OBJECT = "Record<string, never>";

const CLAMP_KEY_REGEX = /(-|\s+|:)/;
const QUOTE_REGEX = /("|')/;
const CUSTOM_EVENT_REGEX = /CustomEvent/;
const COMPONENT_NAME_REGEX = /^[A-Z]/;
const NEWLINE_REGEX = /\n/;
const FUNCTION_TYPE_REGEX = /=>/;
const NEWLINE_TO_COMMENT_REGEX = /\n/g;
const WHITESPACE_REGEX = /\s+/g;

/**
 * Formats a description for use in multi-line comment blocks.
 * Replaces newlines with comment-formatted newlines.
 */
function formatDescriptionForComment(description: string | undefined): string | undefined {
  if (!description) return undefined;
  return description.replace(NEWLINE_TO_COMMENT_REGEX, "\n* ");
}

/**
 * Formats a single-line JSDoc comment.
 */
function formatSingleLineComment(description: string | undefined): string {
  if (!description) return "";
  return `/** ${description} */`;
}

/**
 * Formats a multi-line JSDoc comment with proper newline handling.
 */
function formatMultiLineComment(description: string | undefined): string {
  if (!description) return "";
  return `/**\n * ${description.replace(NEWLINE_TO_COMMENT_REGEX, "\n * ")}\n */`;
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
 * Generates TypeScript type definitions for component contexts.
 *
 * Creates exported type definitions for each context, including generic
 * type parameters when contexts reference component generics. Handles
 * empty context objects by using `Record<string, never>`.
 *
 * @param def - Component documentation containing contexts and generics
 * @returns TypeScript type definition string, or empty string if no contexts
 *
 * @example
 * ```ts
 * // Input: contexts with generic reference
 * // Output:
 * // export type ModalContext<T> = {
 * //   /** Open the modal *\/
 * //   open: () => void;
 * //   /** Close the modal *\/
 * //   close: () => void;
 * // };
 * ```
 */
export function getContextDefs(def: Pick<ComponentDocApi, "contexts" | "generics">) {
  if (!def.contexts || def.contexts.length === 0) return EMPTY_STR;

  /**
   * Extract generic parameter for context types if generics are defined
   * and the context properties reference the generic type.
   */
  const genericsName = def.generics ? def.generics[0] : null;
  const genericsType = def.generics ? def.generics[1] : null;

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

      // If context properties reference the generic type, parameterize the context type
      const referencesGeneric = genericsName && context.properties.some((prop) => prop.type.includes(genericsName));

      // Build generic suffix if context references generics (e.g., `ModalContext<T>`)
      const genericSuffix = referencesGeneric && genericsType ? `<${genericsType}>` : "";

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
 * Creates a prop comment string from a description.
 */
function createPropComment(description: string | undefined): string {
  return [addCommentLine(formatDescriptionForComment(description))].filter(Boolean).join("");
}

/**
 * Wraps comment lines in JSDoc format if comments exist.
 */
function wrapCommentInJSDoc(commentLines: string): string {
  return commentLines.length > 0 ? `/**\n${commentLines}*/` : EMPTY_STR;
}

/**
 * Generates TypeScript prop definitions for a component.
 *
 * Creates the `$Props` type definition including:
 * - Regular props from component declarations
 * - Snippet props for slots (Svelte 5 compatibility)
 * - Rest props handling for elements/components
 * - Generic type parameters
 * - Extends interface merging
 *
 * @param def - Component documentation containing props, slots, rest_props, etc.
 * @returns An object with the props type name and the generated type definition
 *
 * @example
 * ```ts
 * // Generates:
 * // type $Props<T extends string = "default"> = {
 * //   /** The count value *\/
 * //   count?: number;
 * //   /** Header slot *\/
 * //   header?: (this: void, ...args: [{ title: string }]) => void;
 * //   children?: (this: void) => void;
 * // };
 * ```
 */
function genPropDef(
  def: Pick<ComponentDocApi, "props" | "rest_props" | "moduleName" | "extends" | "generics" | "slots">,
) {
  /**
   * Collect existing prop names to avoid conflicts with snippet props.
   * Snippet props are generated for slots, but shouldn't conflict with
   * actual component props.
   */
  const existingPropNames = new Set(
    def.props.filter((prop) => !prop.isFunctionDeclaration && prop.kind !== "const").map((prop) => prop.name),
  );

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

      const prop_comments = [
        addCommentLine(formatDescriptionForComment(prop.description)),
        addCommentLine(prop.constant, "@constant"),
        /**
         * Don't add @default for functions - they don't have meaningful default values.
         * Function props are callbacks, not values with defaults.
         */
        prop.isFunction ? null : `* @default ${defaultValue}\n`,
      ]
        .filter(Boolean)
        .join("");

      const prop_value = prop.constant && !prop.isFunction ? prop.value : prop.type;

      return `
      ${wrapCommentInJSDoc(prop_comments)}
      ${prop.name}${prop.isRequired ? "" : "?"}: ${prop_value};`;
    });

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
      const description = slot.description ? `${formatSingleLineComment(slot.description)}\n      ` : "";
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
  const children_snippet_prop = default_slot
    ? (() => {
        const description = default_slot.description
          ? `${formatSingleLineComment(default_slot.description)}\n      `
          : "";
        const hasSlotProps = default_slot.slot_props && default_slot.slot_props !== "Record<string, never>";
        const snippetType = hasSlotProps
          ? `(this: void, ...args: [${default_slot.slot_props}]) => void`
          : "(this: void) => void";
        return `
      ${description}children?: ${snippetType};`;
      })()
    : "";

  const snippet_props = [...named_snippet_props, children_snippet_prop].filter(Boolean);

  const props = [...initial_props, ...snippet_props].join("\n");

  const props_name = `${def.moduleName}Props`;

  let prop_def = EMPTY_STR;

  /**
   * Full constraints for type definitions (e.g., `type $Props<T extends Foo = Bar>`).
   * Includes the full generic constraint with extends and default.
   */
  const genericsName = def.generics ? `<${def.generics[1]}>` : "";
  /**
   * Names only for type references (e.g., `keyof $Props<T>`).
   * Just the generic parameter name without constraints.
   */
  const genericsNameRef = def.generics ? `<${def.generics[0]}>` : "";

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
      // Map element names to their SvelteHTMLElements types
      extend_tag_map = def.rest_props.name
        .split("|")
        .map((name) => {
          const element = name.trim();
          return `SvelteHTMLElements["${element}"]`;
        })
        .join("&");
    }

    /**
     * Components that extend HTML elements should allow for `data-*` attributes.
     * @see https://github.com/sveltejs/language-tools/issues/1825
     *
     * Even though Svelte 4 does this automatically, we need to preserve this for Svelte 3.
     */

    /**
     * biome-ignore lint/suspicious/noTemplateCurlyInString: type generation
     * Template literal is required for TypeScript's template literal type syntax.
     */
    const dataAttributes = "[key: `data-${string}`]: any;";

    /**
     * When both `@extends` and `@restProps` are present, merge all three type sources:
     * 1. Rest props from element types (SvelteHTMLElements)
     * 2. Component props ($Props)
     * 3. Extended interface (`@extends`)
     */
    if (def.extends !== undefined) {
      prop_def = `
    ${extend_tag_map ? `type $RestProps = ${extend_tag_map};\n` : ""}
    type $Props${genericsName} = {
      ${props}

      ${dataAttributes}
    };

    export type ${props_name}${genericsName} = Omit<$RestProps, keyof ($Props${genericsNameRef} & ${def.extends.interface})> & $Props${genericsNameRef} & ${def.extends.interface};
  `;
    } else {
      prop_def = `
    ${extend_tag_map ? `type $RestProps = ${extend_tag_map};\n` : ""}
    type $Props${genericsName} = {
      ${props}

      ${dataAttributes}
    };

    export type ${props_name}${genericsName} = Omit<$RestProps, keyof $Props${genericsNameRef}> & $Props${genericsNameRef};
  `;
    }
  } else {
    /**
     * Use EMPTY_OBJECT when there are no props and no extends.
     * This ensures we don't generate `{}` which is incompatible with Svelte 4
     * and violates Biome linter rules.
     */
    if (props.trim() === "" && def.extends === undefined) {
      prop_def = `
    export type ${props_name}${genericsName} = ${EMPTY_OBJECT};
  `;
    } else {
      prop_def = `
    export type ${props_name}${genericsName} = ${def.extends !== undefined ? `${def.extends.interface} & ` : ""} {
      ${props}
    }
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
      const description = rest.description ? `${formatSingleLineComment(rest.description)}\n` : "";
      return `${description}${clampKey(key)}: ${formatTsProps(slot_props)};`;
    })
    .join("\n");

  return `{${slotDefs}}`;
}

/**
 * Returns the type name for mapping standard DOM events.
 *
 * lib.dom.d.ts should map event types by name using WindowEventMap.
 * This function returns the type name for that mapping.
 *
 * @returns The type name "WindowEventMap"
 */
const mapEvent = () => {
  return "WindowEventMap";
};

/**
 * Standard DOM events that should use WindowEventMap for type inference.
 *
 * These events are standard browser events that have well-defined types
 * in the DOM type definitions. Using WindowEventMap provides better
 * type safety than generic CustomEvent types.
 */
const STANDARD_DOM_EVENTS = new Set([
  /**
   * Mouse events - pointer interactions with the mouse.
   */
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
  /**
   * Keyboard events - key press interactions.
   */
  "keydown",
  "keyup",
  "keypress",
  /**
   * Form events - form element interactions.
   */
  "submit",
  "change",
  "input",
  "focus",
  "blur",
  "focusin",
  "focusout",
  "reset",
  "select",
  /**
   * Touch events - touch screen interactions.
   */
  "touchstart",
  "touchend",
  "touchmove",
  "touchcancel",
  /**
   * Drag events - drag and drop interactions.
   */
  "drag",
  "dragstart",
  "dragend",
  "dragover",
  "dragenter",
  "dragleave",
  "drop",
  /**
   * Pointer events - unified pointer interactions (mouse, touch, pen).
   */
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
  /**
   * Media events - audio/video element events.
   */
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
  /**
   * Animation/Transition events - CSS animation and transition events.
   */
  "animationstart",
  "animationend",
  "animationiteration",
  "animationcancel",
  "transitionstart",
  "transitionend",
  "transitionrun",
  "transitioncancel",
  /**
   * Other events - miscellaneous browser events.
   */
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
]);

function genEventDef(def: Pick<ComponentDocApi, "events">) {
  const createDispatchedEvent = (detail: string = ANY_TYPE) => {
    if (CUSTOM_EVENT_REGEX.test(detail)) return detail;
    return `CustomEvent<${detail}>`;
  };

  /**
   * Check if an event name is a standard DOM event that exists in WindowEventMap.
   * Standard DOM events should use WindowEventMap for better type inference.
   */
  const isStandardDomEvent = (eventName: string): boolean => {
    return STANDARD_DOM_EVENTS.has(eventName);
  };

  if (def.events.length === 0) return EMPTY_EVENTS;

  const events_map = def.events
    .map((event) => {
      let description = "";
      if (event.description) {
        description = `${formatSingleLineComment(event.description)}\n`;
      }

      let eventType: string;
      if (event.type === "dispatched") {
        eventType = createDispatchedEvent(event.detail);
      } else {
        /**
         * For forwarded events, determine the type based on `@event` JSDoc and element/event type.
         * Handle both serialized (string) and object formats for backward compatibility.
         */
        const elementName = typeof event.element === "string" ? event.element : event.element.name;
        const isComponent = elementName && COMPONENT_NAME_REGEX.test(elementName);
        const isStandardEvent = !isComponent || isStandardDomEvent(event.name);

        /**
         * Check if there's an explicit detail type from `@event` JSDoc (including null).
         * Note: detail="null" on standard DOM events is treated as "not explicitly typed"
         * because `@event` click (without {type}) defaults to null but shouldn't override WindowEventMap.
         * However, for custom component events, explicit null should be respected.
         */
        const hasExplicitDetail =
          event.detail !== undefined && event.detail !== "undefined" && !(event.detail === "null" && isStandardEvent);
        const hasExplicitNullForCustomComponent = event.detail === "null" && !isStandardEvent;

        if (hasExplicitDetail || hasExplicitNullForCustomComponent) {
          /**
           * If `@event` tag explicitly provides a detail type (including null for custom components),
           * always use it (highest priority). This allows developers to override default behavior.
           */
          eventType = createDispatchedEvent(event.detail);
        } else if (isStandardEvent) {
          /**
           * Standard DOM event (native element or standard event name) without explicit type.
           * Use WindowEventMap for better type inference from lib.dom.d.ts.
           */
          eventType = `${mapEvent()}["${event.name}"]`;
        } else {
          /**
           * Custom event from component with no explicit type.
           * Default to CustomEvent<any> since we don't know the detail type.
           */
          eventType = createDispatchedEvent();
        }
      }

      return `${description}${clampKey(event.name)}: ${eventType};\n`;
    })
    .join("");

  return `{${events_map}}`;
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
  /**
   * Check if this is the default function type (would be overridden by `@type` or params/returns).
   * The default `() => any` type is a placeholder that should be replaced with more specific types.
   */
  const isDefaultFunctionType = prop.type === "() => any";

  /**
   * If `@type` tag provides a custom function signature (contains => and is not the default),
   * use it (highest priority). This allows explicit function type annotations.
   */
  if (prop.type && FUNCTION_TYPE_REGEX.test(prop.type) && !isDefaultFunctionType) {
    return prop.type;
  } else if (prop.params && prop.params.length > 0) {
    // Build signature from `@param` tags (most detailed from JSDoc annotations)
    const paramStrings = prop.params.map((param) => {
      const optional = param.optional ? "?" : "";
      return `${param.name}${optional}: ${param.type}`;
    });
    const paramsString = paramStrings.join(", ");
    const returnType = prop.returnType || ANY_TYPE;
    return `(${paramsString}) => ${returnType}`;
  } else if (prop.returnType) {
    // Only `@returns` is present without `@param`
    return `() => ${prop.returnType}`;
  } else {
    /**
     * Fall back to current prop.type.
     * If no JSDoc annotations are present, use the inferred type.
     */
    return prop.type || ANY_TYPE;
  }
}

function genAccessors(def: Pick<ComponentDocApi, "props">) {
  return def.props
    .filter((prop) => prop.isFunctionDeclaration || prop.kind === "const")
    .map((prop) => {
      const prop_comments = createPropComment(prop.description);

      const functionType = generateFunctionType(prop);

      return `
    ${wrapCommentInJSDoc(prop_comments)}
    ${prop.name}: ${functionType};`;
    })
    .join("\n");
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
      const prop_comments = createPropComment(prop.description);

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
        // Build signature from `@param` tags (highest priority for functions)
        const paramStrings = prop.params.map((param) => {
          const optional = param.optional ? "?" : "";
          return `${param.name}${optional}: ${param.type}`;
        });
        const paramsString = paramStrings.join(", ");
        const returnType = prop.returnType || ANY_TYPE;
        type_def = `export declare function ${prop.name}(${paramsString}): ${returnType};`;
      } else if (prop.returnType) {
        // Only `@returns` is present without `@param`
        type_def = `export declare function ${prop.name}(): ${prop.returnType};`;
      } else if (is_function && prop.type && !isDefaultFunctionType) {
        /**
         * `@type` tag provides a custom function signature.
         * Convert function type to function declaration format.
         */
        const [first, second, ...rest] = prop.type.split("=>");
        const rest_type = rest.map((item) => `=>${item}`).join("");
        type_def = `export declare function ${prop.name}${first}:${second}${rest_type};`;
      } else if (is_function && prop.type) {
        /**
         * Fall back to existing function type handling (including default function type).
         * Convert the function type expression to a function declaration.
         */
        const [first, second, ...rest] = prop.type.split("=>");
        const rest_type = rest.map((item) => `=>${item}`).join("");
        type_def = `export declare function ${prop.name}${first}:${second}${rest_type};`;
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

export function writeTsDefinition(component: ComponentDocApi) {
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
  const { props_name, prop_def } = genPropDef({
    moduleName,
    props,
    rest_props,
    extends: _extends,
    generics,
    slots,
  });

  const generic = generics ? `<${generics[1]}>` : "";
  const genericProps = generics ? `${props_name}<${generics[0]}>` : props_name;

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

  return `
  import { SvelteComponentTyped } from "svelte";${
    needsSvelteHTMLElements ? `import type { SvelteHTMLElements } from "svelte/elements";\n` : ""
  }${needsHTMLAttributes ? `import type { HTMLAttributes } from "svelte/elements";\n` : ""}
  ${genImports({ extends: _extends })}
  ${genModuleExports({ moduleExports })}
  ${getTypeDefs({ typedefs })}
  ${contexts && contexts.length > 0 ? "\n" : ""}${getContextDefs({ contexts, generics })}
  ${prop_def}
  ${genComponentComment({ componentComment })}
  export default class ${moduleName === "default" ? "" : moduleName}${generic} extends SvelteComponentTyped<
      ${genericProps},
      ${genEventDef({ events })},
      ${genSlotDef({ slots })}
    > {
      ${genAccessors({ props })}
    }`;
}
