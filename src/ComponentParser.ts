import { parse as parseComment } from "comment-parser";
import type {
  ArrayExpression,
  ArrowFunctionExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  FunctionExpression,
  Identifier,
  Literal,
  MemberExpression,
  NewExpression,
  ObjectExpression,
  Property,
  TemplateLiteral,
  UnaryExpression,
  VariableDeclaration,
  VariableDeclarator,
} from "estree";
import type { Node } from "estree-walker";
import { compile, parse, walk } from "svelte/compiler";
import type { Ast, TemplateNode, Var } from "svelte/types/compiler/interfaces";
import { getElementByTag } from "./element-tag-map";

/**
 * Regular expression for matching variable declarations.
 *
 * Matches `const`, `let`, or `function` declarations and captures the variable name.
 * Used to find variable declarations when searching for JSDoc comments.
 *
 * @example
 * ```ts
 * // Matches:
 * // "const count = 0"     -> captures "count"
 * // "let name = 'test'"   -> captures "name"
 * // "function foo() {}"   -> captures "foo"
 * ```
 */
const VAR_DECLARATION_REGEX = /(?:const|let|function)\s+(\w+)\s*[=(]/;

/**
 * Regular expression for removing leading dash and whitespace from descriptions.
 *
 * Used to clean up inline descriptions in JSDoc tags that may be prefixed
 * with a dash (e.g., `@slot name - description`).
 *
 * @example
 * ```ts
 * // Matches and removes:
 * // "- description"  -> "description"
 * // "-  padded"     -> "padded"
 * ```
 */
const DESCRIPTION_DASH_PREFIX_REGEX = /^-\s*/;

/** Matches a single word character (letter, digit, or underscore). Used for dotted prop access validation. */
const WORD_CHAR_REGEX = /\w/;

/**
 * Extracts description text after the last dash from JSDoc comments.
 *
 * Used for parsing inline descriptions in JSDoc tags like `@event` where the
 * description follows a dash separator.
 *
 * @param description - The description string that may contain a dash separator
 * @returns The description text after the last dash, or the trimmed description if no dash is found
 *
 * @example
 * ```ts
 * extractDescriptionAfterDash("@event click - Fires when clicked")
 * // Returns: "Fires when clicked"
 *
 * extractDescriptionAfterDash("Simple description")
 * // Returns: "Simple description"
 *
 * extractDescriptionAfterDash("@event change - Updates value")
 * // Returns: "Updates value"
 * ```
 */
function extractDescriptionAfterDash(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const dashIndex = description.lastIndexOf("-");
  return dashIndex >= 0 ? description.substring(dashIndex + 1).trim() : description.trim();
}

/**
 * Removes leading dash and whitespace from a description string.
 *
 * Used for cleaning up inline descriptions in JSDoc tags that may have been
 * prefixed with a dash (e.g., `@slot name - description`).
 *
 * @param description - The description string to clean
 * @returns The cleaned description, empty string if result is empty, or undefined if input was undefined
 *
 * @example
 * ```ts
 * cleanDescription("- Description text")
 * // Returns: "Description text"
 *
 * cleanDescription("  -   Padded description  ")
 * // Returns: "Padded description"
 *
 * cleanDescription("-")
 * // Returns: ""
 *
 * cleanDescription(undefined)
 * // Returns: undefined
 * ```
 */
function cleanDescription(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  const cleaned = description.replace(DESCRIPTION_DASH_PREFIX_REGEX, "").trim();
  return cleaned === "" ? "" : cleaned;
}

interface CompiledSvelteCode {
  vars: Var[];
  ast: Ast;
}

/**
 * Diagnostic information for component parsing.
 *
 * Used to provide context about the component being parsed for error
 * messages and logging.
 */
interface ComponentParserDiagnostics {
  /** The module/component name (e.g., "Button", "App") */
  moduleName: string;
  /** The file path to the component (e.g., "./Button.svelte") */
  filePath: string;
}

/**
 * Options for configuring the ComponentParser behavior.
 */
interface ComponentParserOptions {
  /** Enable verbose logging for debugging parsing issues */
  verbose?: boolean;
}

type ComponentPropName = string;

/**
 * Parameter information for function props.
 *
 * Extracted from JSDoc `@param` tags to provide detailed function signatures.
 */
interface ComponentPropParam {
  /** The parameter name */
  name: string;
  /** The parameter type (e.g., "string", "number", "CustomType") */
  type: string;
  /** Optional description from JSDoc */
  description?: string;
  /** Whether the parameter is optional */
  optional?: boolean;
}

/**
 * Component prop definition extracted from Svelte component.
 *
 * Represents a single prop that can be passed to the component, including
 * its type, default value, description, and metadata about whether it's
 * required, reactive, or a function.
 */
interface ComponentProp {
  /** The prop name as declared in the component */
  name: string;
  /** The declaration kind: "let" (required), "const" (optional with default), or "function" */
  kind: "let" | "const" | "function";
  /** Whether this prop is declared as `const` (has a default value) */
  constant: boolean;
  /** The TypeScript type of the prop (e.g., "string", "number | string") */
  type?: string;
  /** The default value as a string representation of the source code */
  value?: string;
  /** Description extracted from JSDoc comments */
  description?: string;
  /** Function parameters (for function props) extracted from `@param` tags */
  params?: ComponentPropParam[];
  /** Return type (for function props) extracted from `@returns` tag */
  returnType?: string;
  /** Whether this prop is a function (arrow function or function expression) */
  isFunction: boolean;
  /** Whether this prop is a function declaration (not an expression) */
  isFunctionDeclaration: boolean;
  /** Whether this prop is required (no default value, declared with `let`) */
  isRequired: boolean;
  /** Whether this prop is reactive (can change and trigger reactivity) */
  reactive: boolean;
}

/**
 * Default slot name constant.
 *
 * Used to represent the default (unnamed) slot in Svelte components.
 * The default slot is accessed without a name attribute.
 */
const DEFAULT_SLOT_NAME = null;

type ComponentSlotName = typeof DEFAULT_SLOT_NAME | string;

/**
 * Regular expression for detecting type definition endings.
 *
 * Matches closing braces that indicate the end of a type definition
 * (e.g., `}` or `};`). Used to determine if a typedef should be
 * formatted as an interface or type alias.
 *
 * @example
 * ```ts
 * // Matches:
 * // "{ x: number }"     -> interface
 * // "{ x: number };"    -> interface
 * // "string | number"   -> type alias
 * ```
 */
const TYPEDEF_END_REGEX = /(\}|\};)$/;

/**
 * Regular expression for splitting context keys into parts.
 *
 * Splits on dashes, underscores, and whitespace to convert kebab-case,
 * snake_case, or space-separated keys into parts for PascalCase conversion.
 *
 * @example
 * ```ts
 * // Splits:
 * // "simple-modal"  -> ["simple", "modal"]
 * // "user_settings" -> ["user", "settings"]
 * // "my context"     -> ["my", "context"]
 * ```
 */
const CONTEXT_KEY_SPLIT_REGEX = /[-_.:/\s]+/;

/**
 * Regular expression for matching component comment markers.
 *
 * Matches HTML comments that start with `@component` in the template.
 * Used to extract component-level descriptions.
 *
 * @example
 * ```ts
 * // Matches:
 * // "<!-- @component This is a button component -->"
 * ```
 */
const COMPONENT_COMMENT_REGEX = /^@component/;

/**
 * Regular expression for matching carriage return characters.
 *
 * Global regex for removing `\r` characters from strings.
 * Used to normalize line endings when processing component comments.
 */
const CARRIAGE_RETURN_REGEX = /\r/g;

/**
 * Regular expression for matching newline and carriage return characters.
 *
 * Global regex for matching all newline variations (`\n`, `\r\n`, `\r`).
 * Used to normalize or replace newlines in source code strings.
 *
 * @example
 * ```ts
 * // Matches:
 * // "\n"     -> newline
 * // "\r\n"   -> Windows line ending
 * // "\r"     -> carriage return
 * ```
 */
const NEWLINE_CR_REGEX = /[\r\n]+/g;

/**
 * Component slot definition.
 *
 * Represents a slot that can be used to pass content into the component.
 * Includes information about slot props, fallback content, and descriptions.
 */
interface ComponentSlot {
  /** The slot name (null or undefined for default slot) */
  name?: string | null;
  /** Whether this is the default slot */
  default: boolean;
  /** Fallback content to display when slot is not provided */
  fallback?: string;
  /** TypeScript type definition for slot props (e.g., "{ title: string }") */
  slot_props?: string;
  /** Description extracted from JSDoc `@slot` tags */
  description?: string;
}

/**
 * Slot prop value definition.
 *
 * Used internally to track slot prop types and whether they should be
 * replaced with prop type references.
 */
interface SlotPropValue {
  /** The prop type value or reference */
  value?: string;
  /** Whether this value should be replaced with a prop type reference */
  replace: boolean;
}

type SlotProps = Record<string, SlotPropValue>;

type ComponentEventName = string;

/**
 * Event that is forwarded from a child component or element.
 *
 * Forwarded events are those that use `on:eventname` syntax without
 * a handler, passing the event through to the parent.
 */
interface ForwardedEvent {
  /** Always "forwarded" for forwarded events */
  type: "forwarded";
  /** The event name (e.g., "click", "change") */
  name: string;
  /** The element or component that forwards this event */
  element: ComponentInlineElement | ComponentElement;
  /** Description extracted from JSDoc `@event` tags */
  description?: string;
  /** The detail type if explicitly specified in `@event` tag */
  detail?: string;
}

/**
 * Event that is dispatched by the component.
 *
 * Dispatched events are those created with `createEventDispatcher()`
 * and dispatched via `dispatch("eventname", detail)`.
 */
interface DispatchedEvent {
  /** Always "dispatched" for dispatched events */
  type: "dispatched";
  /** The event name (e.g., "click", "change") */
  name: string;
  /** The detail type (e.g., "{ value: string }", "null", "CustomEvent<...>") */
  detail?: string;
  /** Description extracted from JSDoc `@event` tags */
  description?: string;
}

type ComponentEvent = ForwardedEvent | DispatchedEvent;

/**
 * Serialized version of {@link ForwardedEvent} for JSON output.
 *
 * This interface maintains backward compatibility by serializing the `element`
 * property as a string instead of an object. The element name is extracted
 * from the {@link ComponentInlineElement} or {@link ComponentElement} object.
 *
 * @example
 * ```ts
 * // ForwardedEvent with element object:
 * { type: "forwarded", name: "click", element: { type: "Element", name: "button" } }
 *
 * // SerializedForwardedEvent for JSON:
 * { type: "forwarded", name: "click", element: "button" }
 * ```
 */
interface SerializedForwardedEvent {
  /** Always "forwarded" for forwarded events */
  type: "forwarded";
  /** The event name (e.g., "click", "change") */
  name: string;
  /**
   * Serialized as string for JSON backward compatibility.
   * In the internal API, this is an object, but for JSON output it's a string.
   */
  element: string;
  /** Description extracted from JSDoc `@event` tags */
  description?: string;
  /** The detail type if explicitly specified in `@event` tag */
  detail?: string;
}

type SerializedComponentEvent = SerializedForwardedEvent | DispatchedEvent;

type TypeDefName = string;

/**
 * Type definition extracted from JSDoc `@typedef` tags.
 *
 * Represents custom types defined in component comments that can be
 * referenced by props, events, and other type annotations.
 */
interface TypeDef {
  /** The type string representation (e.g., "{ x: number; y: number }") */
  type: string;
  /** The type name (e.g., "Point", "User") */
  name: string;
  /** Description extracted from JSDoc comments */
  description?: string;
  /** The full TypeScript type definition string (e.g., "type Point = { x: number; y: number }") */
  ts: string;
}

type ComponentGenerics = [name: string, type: string] | null;

/**
 * Represents an inline Svelte component element.
 *
 * Used to identify which component forwards an event or accepts rest props.
 */
interface ComponentInlineElement {
  /** Always "InlineComponent" for component elements */
  type: "InlineComponent";
  /** The component name (e.g., "Button", "Modal") */
  name: string;
}

interface ComponentElement {
  type: "Element";
  name: string;
  /**
   * For `svelte:element`, stores the hardcoded element tag if `this` is a literal string.
   *
   * When `svelte:element` is used with a static tag (e.g., `svelte:element this="div"`),
   * this property contains the tag name. If the tag is dynamic, this property is undefined.
   *
   * @example
   * ```svelte
   * <!-- Static tag -->
   * <svelte:element this="div" bind:this={elementRef} />
   * // thisValue: "div"
   *
   * <!-- Dynamic tag -->
   * <svelte:element this={tagName} bind:this={elementRef} />
   * // thisValue: undefined
   * ```
   */
  thisValue?: string;
  /** Inline or block description from the `@restProps` JSDoc tag */
  description?: string;
}

type RestProps = undefined | ComponentInlineElement | ComponentElement;

/**
 * Interface extension information from JSDoc `@extends` tag.
 *
 * Allows components to extend external TypeScript interfaces for
 * better type safety and code reuse.
 */
interface Extends {
  /** The interface name to extend (e.g., "ButtonProps") */
  interface: string;
  /** The import path for the interface (e.g., "./types" or "carbon-components-svelte") */
  import: string;
}

interface ComponentPropBindings {
  elements: string[];
}

type ComponentContextName = string;

/**
 * Property definition for a component context.
 *
 * Represents a single property in a context object created with `setContext`.
 */
interface ComponentContextProp {
  /** The property name */
  name: string;
  /** The property type (inferred from JSDoc or variable types) */
  type: string;
  /** Description extracted from JSDoc comments on the variable */
  description?: string;
  /** Whether the property is optional */
  optional: boolean;
}

/**
 * Component context definition.
 *
 * Represents a context created with `setContext(key, value)` that can be
 * accessed by child components via `getContext(key)`.
 */
interface ComponentContext {
  /** The context key (e.g., "modal", "tabs") */
  key: string;
  /** The generated TypeScript type name (e.g., "ModalContext", "TabsContext") */
  typeName: string;
  /** Description extracted from JSDoc comments */
  description?: string;
  /** Properties available in this context */
  properties: ComponentContextProp[];
}

/**
 * Complete parsed component metadata.
 *
 * This is the main return type from {@link ComponentParser.parseSvelteComponent}.
 * Contains all extracted information about a Svelte component including props,
 * slots, events, types, and more.
 *
 * @example
 * ```ts
 * const parser = new ComponentParser();
 * const parsed = parser.parseSvelteComponent(source, {
 *   moduleName: "Button",
 *   filePath: "./Button.svelte"
 * });
 *
 * // Access component metadata:
 * parsed.props        // Array of component props
 * parsed.slots        // Array of component slots
 * parsed.events       // Array of component events
 * parsed.typedefs     // Array of custom type definitions
 * parsed.contexts     // Array of context definitions
 * ```
 */
export interface ParsedComponent {
  /** Component props that can be passed to the component */
  props: ComponentProp[];
  /** Exports from `<script context="module">` block */
  moduleExports: ComponentProp[];
  /** Slots available in the component template */
  slots: ComponentSlot[];
  /** Events that the component can dispatch or forward */
  events: ComponentEvent[];
  /** Custom type definitions from JSDoc `@typedef` tags */
  typedefs: TypeDef[];
  /** Generic type parameters (e.g., `[name: "T", type: "string"]`) or null */
  generics: null | ComponentGenerics;
  /** Rest props configuration (which elements/components accept rest props) */
  rest_props: RestProps;
  /** Interface extension from JSDoc `@extends` tag */
  extends?: Extends;
  /** Component-level description from `@component` HTML comment */
  componentComment?: string;
  /** Contexts created with `setContext` in the component */
  contexts?: ComponentContext[];
}

export default class ComponentParser {
  /** Parser configuration options (e.g., verbose logging) */
  private options?: ComponentParserOptions;

  /** Raw source code of the Svelte component being parsed */
  private source?: string;

  /** Compiled Svelte code containing extracted variables and AST */
  private compiled?: CompiledSvelteCode;

  /** Parsed abstract syntax tree from the Svelte compiler */
  private parsed?: Ast;

  /** Rest props configuration (e.g., `$$restProps`) if present in component */
  private rest_props?: RestProps;

  /** Component extension information (e.g., `extends` attribute) */
  private extends?: Extends;

  /** Component-level description extracted from `@component` HTML comment */
  private componentComment?: string;

  /** Set of reactive variable names found in the component */
  private readonly reactive_vars: Set<string> = new Set();

  /** Set of all variable declarations found in the component script */
  private readonly vars: Set<VariableDeclaration> = new Set();

  /** Map of component props keyed by prop name */
  private readonly props: Map<ComponentPropName, ComponentProp> = new Map();

  /** Map of module exports (functions/variables exported from script) keyed by name */
  private readonly moduleExports: Map<ComponentPropName, ComponentProp> = new Map();

  /** Map of component slots keyed by slot name (null for default slot) */
  private readonly slots: Map<ComponentSlotName, ComponentSlot> = new Map();

  /** Map of component events (dispatched events) keyed by event name */
  private readonly events: Map<ComponentEventName, ComponentEvent> = new Map();

  /** Map of event descriptions extracted from JSDoc comments keyed by event name */
  private readonly eventDescriptions: Map<ComponentEventName, string | undefined> = new Map();

  /** Map of forwarded events (events forwarded from child components) keyed by event name */
  private readonly forwardedEvents: Map<ComponentEventName, ComponentInlineElement | ComponentElement> = new Map();

  /** Map of type definitions (typedefs) extracted from JSDoc comments keyed by type name */
  private readonly typedefs: Map<TypeDefName, TypeDef> = new Map();

  /** Component generic type parameters (null if no generics) */
  private generics: ComponentGenerics = null;

  /** Map of prop bindings (e.g., `bind:value`) keyed by prop name */
  private readonly bindings: Map<ComponentPropName, ComponentPropBindings> = new Map();

  /** Map of component contexts (created with `setContext`) keyed by context name */
  private readonly contexts: Map<ComponentContextName, ComponentContext> = new Map();

  /** Cache for variable type and description information to avoid redundant lookups */
  private variableInfoCache: Map<string, { type: string; description?: string }> = new Map();

  /** Cached array of source code lines split by newline for efficient line-based operations */
  private sourceLinesCache?: string[];

  constructor(options?: ComponentParserOptions) {
    this.options = options;
  }

  private static mapToArray<T>(map: Map<string, T> | Map<ComponentSlotName, T>) {
    return Array.from(map, ([_key, value]) => value);
  }

  private static assignValue(value?: "" | string) {
    return value === undefined || value === "" ? undefined : value;
  }

  private static formatComment(comment: string) {
    let formatted_comment = comment;

    if (!formatted_comment.startsWith("/*")) {
      formatted_comment = `/*${formatted_comment}`;
    }

    if (!formatted_comment.endsWith("*/")) {
      formatted_comment += "*/";
    }

    return formatted_comment;
  }

  /**
   * Extracts and categorizes JSDoc tags from a parsed comment.
   *
   * Separates tags into type, param, returns, and additional categories while
   * excluding tags that are handled separately (extends, restProps, slot, event, typedef).
   *
   * @param parsed - The parsed comment result from comment-parser
   * @returns An object containing categorized tags and the comment description
   *
   * @example
   * ```ts
   * // Input: Parsed comment with tags
   * // Output:
   * {
   *   type: { tag: "type", type: "string" },
   *   param: [
   *     { tag: "param", name: "value", type: "string" }
   *   ],
   *   returns: { tag: "returns", type: "void" },
   *   additional: [{ tag: "since", name: "1.0.0" }],
   *   description: "Main description text"
   * }
   * ```
   */
  private getCommentTags(parsed: ReturnType<typeof parseComment>) {
    const tags = parsed[0]?.tags ?? [];
    const excludedTags = new Set([
      "type",
      "param",
      "returns",
      "return",
      "extends",
      "extendProps",
      "restProps",
      "slot",
      "event",
      "typedef",
    ]);

    let typeTag: (typeof tags)[number] | undefined;
    const paramTags: typeof tags = [];
    let returnsTag: (typeof tags)[number] | undefined;
    const additionalTags: typeof tags = [];

    for (const tag of tags) {
      if (tag.tag === "type") {
        typeTag = tag;
      } else if (tag.tag === "param") {
        paramTags.push(tag);
      } else if (tag.tag === "returns" || tag.tag === "return") {
        returnsTag = tag;
      } else if (!excludedTags.has(tag.tag)) {
        additionalTags.push(tag);
      }
    }

    return {
      type: typeTag,
      param: paramTags,
      returns: returnsTag,
      additional: additionalTags,
      description: parsed[0]?.description,
    };
  }

  /**
   * Finds the last comment from an array of leading comments.
   *
   * TypeScript directives are stripped before parsing, so we can safely take
   * the last comment as it will be the JSDoc comment if present.
   *
   * @param leadingComments - Array of comment nodes from the AST
   * @returns The last comment's value if found, undefined otherwise
   *
   * @example
   * ```ts
   * // Given leadingComments with multiple comments:
   * // [/* regular comment *\/, /** JSDoc comment *\/]
   * // Returns: { value: " JSDoc comment " }
   *
   * // If no comments:
   * // Returns: undefined
   * ```
   */
  private static findJSDocComment(leadingComments: unknown[]): { value: string } | undefined {
    if (!leadingComments || leadingComments.length === 0) return undefined;
    const comment = leadingComments[leadingComments.length - 1];
    return comment && typeof comment === "object" && "value" in comment ? (comment as { value: string }) : undefined;
  }

  /**
   * Processes JSDoc comments from leadingComments and extracts structured information.
   *
   * Parses JSDoc comments to extract type information, parameters, return types,
   * and descriptions. Handles both inline and block-level descriptions.
   *
   * @param leadingComments - Array of comment nodes from the AST
   * @returns Structured JSDoc information or undefined if no JSDoc comment is found
   *
   * @example
   * ```ts
   * // Input JSDoc:
   * /**
   *  * @type {string}
   *  * @param {number} x - The x coordinate
   *  * @param {number} y - The y coordinate
   *  * @returns {void}
   *  * Description text
   *  *\/
   *
   * // Output:
   * {
   *   type: "string",
   *   params: [
   *     { name: "x", type: "number", description: "The x coordinate", optional: false },
   *     { name: "y", type: "number", description: "The y coordinate", optional: false }
   *   ],
   *   returnType: "void",
   *   description: "Description text"
   * }
   * ```
   */
  private processJSDocComment(leadingComments: unknown[]):
    | {
        type?: string;
        params?: ComponentPropParam[];
        returnType?: string;
        description?: string;
      }
    | undefined {
    if (!leadingComments) return undefined;

    const jsdoc_comment = ComponentParser.findJSDocComment(leadingComments);
    if (!jsdoc_comment) return undefined;

    const comment = parseComment(ComponentParser.formatComment(jsdoc_comment.value), {
      spacing: "preserve",
    });

    const {
      type: typeTag,
      param: paramTags,
      returns: returnsTag,
      additional: additionalTags,
      description: commentDescription,
    } = this.getCommentTags(comment);

    let type: string | undefined;
    let params: ComponentPropParam[] | undefined;
    let returnType: string | undefined;
    let description: string | undefined;

    // `@type` tag overrides any inferred type from the initializer
    if (typeTag) type = this.aliasType(typeTag.type);

    /**
     * Extract `@param` tags to document function parameters.
     * Nested params like "options.expand" are excluded as they represent
     * object property access rather than direct parameters.
     */
    if (paramTags.length > 0) {
      params = paramTags
        .filter((tag) => !tag.name.includes("."))
        .map((tag) => ({
          name: tag.name,
          type: this.aliasType(tag.type),
          description: cleanDescription(tag.description),
          optional: tag.optional || false,
        }));
    }

    if (returnsTag) returnType = this.aliasType(returnsTag.type);

    /**
     * Build description from comment description and non-param/non-type tags.
     * Additional tags (like `@since`, `@deprecated`) are included in the description
     * as formatted strings to preserve all metadata.
     */
    const formattedDescription = ComponentParser.assignValue(commentDescription?.trim());
    if (formattedDescription || additionalTags.length > 0) {
      const descriptionParts: string[] = [];
      if (formattedDescription) {
        descriptionParts.push(formattedDescription);
      }
      for (const tag of additionalTags) {
        const tagStr = `@${tag.tag}${tag.name ? ` ${tag.name}` : ""}${tag.description ? ` ${tag.description}` : ""}`;
        descriptionParts.push(tagStr);
      }
      description = descriptionParts.join("\n");
    }

    return { type, params, returnType, description };
  }

  /**
   * Checks if a MemberExpression represents a well-known numeric constant.
   *
   * Identifies constants from the Number and Math objects that should be
   * typed as `number` rather than their literal values.
   *
   * @param memberExpr - The AST node to check
   * @returns True if the expression is a recognized numeric constant
   *
   * @example
   * ```ts
   * // Recognized constants:
   * Number.POSITIVE_INFINITY  // true
   * Number.MAX_VALUE          // true
   * Math.PI                   // true
   * Math.E                    // true
   *
   * // Not recognized:
   * Custom.CONSTANT           // false
   * Number.UNKNOWN            // false
   * ```
   */
  private isNumericConstant(memberExpr: unknown): boolean {
    if (!memberExpr || typeof memberExpr !== "object" || !("type" in memberExpr)) return false;
    if (memberExpr.type !== "MemberExpression") return false;

    const expr = memberExpr as MemberExpression;
    const objectName = expr.object && "name" in expr.object ? (expr.object as Identifier).name : undefined;
    const propertyName = expr.property && "name" in expr.property ? (expr.property as Identifier).name : undefined;

    if (!objectName || !propertyName) return false;

    if (objectName === "Number") {
      return [
        "POSITIVE_INFINITY",
        "NEGATIVE_INFINITY",
        "MAX_VALUE",
        "MIN_VALUE",
        "MAX_SAFE_INTEGER",
        "MIN_SAFE_INTEGER",
        "EPSILON",
        "NaN",
      ].includes(propertyName);
    }

    if (objectName === "Math") {
      return ["PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT2", "SQRT1_2"].includes(propertyName);
    }

    return false;
  }

  /**
   * Extracts source code at the given position range.
   *
   * @param start - Start position in the source
   * @param end - End position in the source
   * @returns The source code substring, or undefined if source is not available
   */
  private sourceAtPos(start: number, end: number) {
    return this.source?.slice(start, end);
  }

  /**
   * Processes an initializer expression to extract its value, type, and function status.
   *
   * Handles various expression types including object literals, arrays, binary expressions,
   * arrow functions, unary expressions, identifiers, member expressions, template literals,
   * and primitive literals. Extracts the source code representation and infers types
   * where possible.
   *
   * @param init - The initializer AST node
   * @returns An object containing the value (source code), inferred type, and whether it's a function
   *
   * @example
   * ```ts
   * // ObjectExpression: { x: 1, y: 2 }
   * // Returns: { value: "{ x: 1, y: 2 }", type: "{ x: 1, y: 2 }", isFunction: false }
   *
   * // ArrowFunctionExpression: () => {}
   * // Returns: { value: undefined, type: "(...args: any[]) => any", isFunction: true }
   *
   * // Literal: "hello"
   * // Returns: { value: '"hello"', type: "string", isFunction: false }
   *
   * // BinaryExpression: "a" + "b"
   * // Returns: { value: '"a" + "b"', type: "string", isFunction: false }
   *
   * // MemberExpression: Math.PI
   * // Returns: { value: "Math.PI", type: "number" (if numeric constant), isFunction: false }
   * ```
   */
  private processInitializer(init: unknown): { value?: string; type?: string; isFunction: boolean } {
    let value: string | undefined;
    let type: string | undefined;
    let isFunction = false;

    if (!init || typeof init !== "object" || !("type" in init)) {
      return { value, type, isFunction };
    }

    if (
      init.type === "ObjectExpression" ||
      init.type === "BinaryExpression" ||
      init.type === "ArrayExpression" ||
      init.type === "ArrowFunctionExpression"
    ) {
      const expr = init as ObjectExpression | BinaryExpression | ArrayExpression | ArrowFunctionExpression;
      if ("start" in expr && "end" in expr && typeof expr.start === "number" && typeof expr.end === "number") {
        value = this.sourceAtPos(expr.start, expr.end)?.replace(NEWLINE_CR_REGEX, " ");
      }
      type = value;
      isFunction = init.type === "ArrowFunctionExpression";

      if (init.type === "BinaryExpression") {
        const binExpr = init as BinaryExpression;
        if (
          binExpr.left &&
          typeof binExpr.left === "object" &&
          "type" in binExpr.left &&
          binExpr.left.type === "Literal" &&
          "value" in binExpr.left &&
          typeof binExpr.left.value === "string"
        ) {
          type = "string";
        }
      }

      if (init.type === "ArrowFunctionExpression") {
        type = "(...args: any[]) => any";
        value = undefined;
      }
    } else if (init.type === "UnaryExpression") {
      const unaryExpr = init as UnaryExpression;
      if (
        "start" in unaryExpr &&
        "end" in unaryExpr &&
        typeof unaryExpr.start === "number" &&
        typeof unaryExpr.end === "number"
      ) {
        value = this.sourceAtPos(unaryExpr.start, unaryExpr.end);
      }
      if (unaryExpr.argument) {
        // If the argument is another UnaryExpression, recursively resolve the type
        if (
          typeof unaryExpr.argument === "object" &&
          "type" in unaryExpr.argument &&
          unaryExpr.argument.type === "UnaryExpression"
        ) {
          const nestedResult = this.processInitializer(unaryExpr.argument);
          type = nestedResult.type;
        } else if (typeof unaryExpr.argument === "object" && "value" in unaryExpr.argument) {
          // Direct literal argument
          type = typeof (unaryExpr.argument as Literal).value;
        }
      }
    } else if (init.type === "NewExpression") {
      const newExpr = init as NewExpression;
      if (
        "start" in newExpr &&
        "end" in newExpr &&
        typeof newExpr.start === "number" &&
        typeof newExpr.end === "number"
      ) {
        value = this.sourceAtPos(newExpr.start, newExpr.end);
      }
      // Infer type from callee if it's an Identifier (e.g., new Date() -> Date)
      if (
        newExpr.callee &&
        typeof newExpr.callee === "object" &&
        "type" in newExpr.callee &&
        newExpr.callee.type === "Identifier"
      ) {
        const calleeName = (newExpr.callee as Identifier).name;
        // Common built-in constructors
        if (calleeName === "Date") {
          type = "Date";
        } else if (calleeName === "Map") {
          type = "Map<any, any>";
        } else if (calleeName === "Set") {
          type = "Set<any>";
        } else if (calleeName === "WeakMap") {
          type = "WeakMap<object, any>";
        } else if (calleeName === "WeakSet") {
          type = "WeakSet<object>";
        } else if (calleeName === "Array") {
          type = "any[]";
        } else if (calleeName === "RegExp" || calleeName === "Regexp") {
          type = "RegExp";
        } else if (calleeName === "Error") {
          type = "Error";
        } else {
          // For other constructors, use the constructor name as the type
          type = calleeName;
        }
      }
    } else if (init.type === "CallExpression") {
      const callExpr = init as CallExpression;
      if (
        "start" in callExpr &&
        "end" in callExpr &&
        typeof callExpr.start === "number" &&
        typeof callExpr.end === "number"
      ) {
        value = this.sourceAtPos(callExpr.start, callExpr.end);
      }
    } else if (init.type === "Identifier") {
      const ident = init as Identifier;
      if ("start" in ident && "end" in ident && typeof ident.start === "number" && typeof ident.end === "number") {
        value = this.sourceAtPos(ident.start, ident.end);
      }
    } else if (init.type === "MemberExpression") {
      const memberExpr = init as MemberExpression;
      if (
        "start" in memberExpr &&
        "end" in memberExpr &&
        typeof memberExpr.start === "number" &&
        typeof memberExpr.end === "number"
      ) {
        value = this.sourceAtPos(memberExpr.start, memberExpr.end);
      }
      if (this.isNumericConstant(init)) {
        type = "number";
      }
    } else if (init.type === "TemplateLiteral") {
      const template = init as TemplateLiteral;
      if (
        "start" in template &&
        "end" in template &&
        typeof template.start === "number" &&
        typeof template.end === "number"
      ) {
        value = this.sourceAtPos(template.start, template.end);
      }
      type = "string";
    } else if ("raw" in init && typeof init.raw === "string") {
      value = init.raw;
      if ("value" in init) {
        type = init.value == null ? undefined : typeof init.value;
      }
    }

    return { value, type, isFunction };
  }

  /**
   * Collects reactive variables from the compiled Svelte component.
   *
   * Reactive variables are those that are both reassigned and writable,
   * indicating they can change and trigger reactivity in Svelte.
   */
  private collectReactiveVars() {
    const reactiveVars = this.compiled?.vars.filter(({ reassigned, writable }) => reassigned && writable) ?? [];
    for (const { name } of reactiveVars) {
      this.reactive_vars.add(name);
    }
  }

  /**
   * Adds or merges a component prop to the props map.
   *
   * If a prop with the same name already exists, the new data is merged
   * with the existing prop, with new values taking precedence.
   *
   * @param prop_name - The name of the prop
   * @param data - The prop data to add or merge
   *
   * @example
   * ```ts
   * // First call:
   * addProp("count", { name: "count", type: "number", kind: "let" })
   * // Props map: { "count" => { name: "count", type: "number", kind: "let" } }
   *
   * // Second call (merge):
   * addProp("count", { description: "The count value" })
   * // Props map: { "count" => { name: "count", type: "number", kind: "let", description: "The count value" } }
   * ```
   */
  private addProp(prop_name: string, data: ComponentProp) {
    if (ComponentParser.assignValue(prop_name) === undefined) return;

    if (this.props.has(prop_name)) {
      const existing_slot = this.props.get(prop_name);

      this.props.set(prop_name, {
        ...existing_slot,
        ...data,
      });
    } else {
      this.props.set(prop_name, data);
    }
  }

  /**
   * Adds or merges a module export to the moduleExports map.
   *
   * Similar to {@link addProp}, but for exported values from the module script.
   * If an export with the same name already exists, the new data is merged
   * with the existing export.
   *
   * @param prop_name - The name of the exported value
   * @param data - The export data to add or merge
   *
   * @example
   * ```ts
   * // For: export const API_URL = "https://api.example.com"
   * addModuleExport("API_URL", {
   *   name: "API_URL",
   *   kind: "const",
   *   type: "string",
   *   value: '"https://api.example.com"'
   * })
   * ```
   */
  private addModuleExport(prop_name: string, data: ComponentProp) {
    if (ComponentParser.assignValue(prop_name) === undefined) return;

    if (this.moduleExports.has(prop_name)) {
      const existing_slot = this.moduleExports.get(prop_name);

      this.moduleExports.set(prop_name, {
        ...existing_slot,
        ...data,
      });
    } else {
      this.moduleExports.set(prop_name, data);
    }
  }

  /**
   * Normalizes type strings by aliasing common patterns.
   *
   * Converts `*` to `any` (common JSDoc wildcard) and trims whitespace
   * from type annotations.
   *
   * @param type - The type string to normalize
   * @returns The normalized type string
   *
   * @example
   * ```ts
   * aliasType("*")        // Returns: "any"
   * aliasType(" string ") // Returns: "string"
   * aliasType("number")   // Returns: "number"
   * ```
   */
  private aliasType(type: string) {
    if (type === "*") return "any";
    return type.trim();
  }

  /**
   * Extracts a property's type from an object type string.
   *
   * Parses type strings like `{ value: string; other: number }` and returns
   * the type for the requested property name. Handles nested braces, generics,
   * and optional properties.
   *
   * @returns The property type string, or undefined if not found
   */
  private extractPropertyType(typeStr: string, propName: string): string | undefined {
    const trimmed = typeStr.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return undefined;

    const inner = trimmed.slice(1, -1);
    const segments: string[] = [];
    let depth = 0;
    let current = "";

    for (const char of inner) {
      if (char === "{" || char === "<" || char === "(" || char === "[") {
        depth++;
        current += char;
      } else if (char === "}" || char === ">" || char === ")" || char === "]") {
        depth--;
        current += char;
      } else if ((char === ";" || char === ",") && depth === 0) {
        segments.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    if (current.trim()) segments.push(current.trim());

    for (const segment of segments) {
      if (!segment.startsWith(propName)) continue;
      const afterName = segment.slice(propName.length);
      if (afterName.length > 0 && WORD_CHAR_REGEX.test(afterName[0])) continue;
      let rest = afterName.trimStart();
      if (rest.startsWith("?")) rest = rest.slice(1).trimStart();
      if (rest.startsWith(":")) {
        return rest.slice(1).trim();
      }
    }

    return undefined;
  }

  /**
   * Resolves the type of a MemberExpression (e.g., `obj.value`) by looking up
   * the object's type annotation and extracting the property type.
   *
   * @returns The resolved type string, or undefined if it cannot be resolved
   */
  private resolveMemberExpressionType(expr: unknown): string | undefined {
    const memberExpr = expr as {
      object?: { type?: string; name?: string };
      property?: { type?: string; name?: string };
      computed?: boolean;
    };

    if (memberExpr.computed || memberExpr.object?.type !== "Identifier" || memberExpr.property?.type !== "Identifier") {
      return undefined;
    }

    const objName = memberExpr.object.name;
    const propName = memberExpr.property.name;
    if (!objName || !propName) return undefined;

    const objType = this.props.get(objName)?.type ?? this.findVariableTypeAndDescription(objName)?.type;
    if (!objType) return undefined;

    return this.extractPropertyType(objType, propName);
  }

  /**
   * Adds or merges a slot definition to the slots map.
   *
   * Handles both named slots and the default slot. If a slot with the same
   * name already exists, merges the data with existing values taking precedence
   * where appropriate.
   *
   * @param slot_name - Optional slot name (undefined/empty = default slot)
   * @param slot_props - Optional slot props type definition
   * @param slot_fallback - Optional fallback content for the slot
   * @param slot_description - Optional description for the slot
   *
   * @example
   * ```ts
   * // Default slot:
   * addSlot({ slot_name: undefined, slot_props: "{ children: string }" })
   *
   * // Named slot:
   * addSlot({
   *   slot_name: "header",
   *   slot_props: "{ title: string }",
   *   slot_description: "Header slot with title prop"
   * })
   *
   * // Slot with fallback:
   * addSlot({
   *   slot_name: "footer",
   *   slot_fallback: "<p>Default footer</p>"
   * })
   * ```
   */
  private addSlot({
    slot_name,
    slot_props,
    slot_fallback,
    slot_description,
  }: {
    slot_name?: string;
    slot_props?: string;
    slot_fallback?: string;
    slot_description?: string;
  }) {
    const default_slot = slot_name === undefined || slot_name === "";
    const name: ComponentSlotName = default_slot ? DEFAULT_SLOT_NAME : (slot_name ?? "");
    const fallback = ComponentParser.assignValue(slot_fallback);
    const props = ComponentParser.assignValue(slot_props);
    const description = extractDescriptionAfterDash(slot_description);

    if (this.slots.has(name)) {
      const existing_slot = this.slots.get(name);
      if (existing_slot) {
        this.slots.set(name, {
          ...existing_slot,
          default: existing_slot.default ?? default_slot,
          fallback,
          slot_props: existing_slot.slot_props === undefined ? props : existing_slot.slot_props,
          description: existing_slot.description || description,
        });
      }
    } else {
      this.slots.set(name, {
        name,
        default: default_slot,
        fallback,
        slot_props,
        description,
      });
    }
  }

  /**
   * Adds or merges a dispatched event to the events map.
   *
   * Handles event detail type inference: if no argument is provided to the
   * dispatcher and no `@event` tag specifies a detail type, the detail defaults
   * to `null`. Otherwise, uses the provided detail type.
   *
   * @param name - The event name
   * @param detail - The event detail type string
   * @param has_argument - Whether the dispatcher call includes a detail argument
   * @param description - Optional event description
   *
   * @example
   * ```ts
   * // Event without detail:
   * // createEventDispatcher()("click")
   * addDispatchedEvent({
   *   name: "click",
   *   detail: "",
   *   has_argument: false,
   *   description: "Fires on click"
   * })
   * // Result: { type: "dispatched", name: "click", detail: "null" }
   *
   * // Event with detail:
   * // dispatch("change", { value: 42 })
   * addDispatchedEvent({
   *   name: "change",
   *   detail: "{ value: number }",
   *   has_argument: true,
   *   description: "Fires when value changes"
   * })
   * // Result: { type: "dispatched", name: "change", detail: "{ value: number }" }
   * ```
   */
  private addDispatchedEvent({
    name,
    detail,
    has_argument,
    description,
  }: Pick<DispatchedEvent, "name" | "description"> & { detail: string; has_argument: boolean }) {
    if (name === undefined) return;

    /**
     * `e.detail` should be `null` if the dispatcher is not provided a second
     * argument and if `@event` is not specified. This matches Svelte's behavior
     * where events without detail have `detail: null`.
     */
    const default_detail = !has_argument && !detail ? "null" : ComponentParser.assignValue(detail);
    const event_description = extractDescriptionAfterDash(description);
    if (this.events.has(name)) {
      const existing_event = this.events.get(name) as DispatchedEvent;
      this.events.set(name, {
        ...existing_event,
        detail: existing_event.detail === undefined ? default_detail : existing_event.detail,
        description: existing_event.description || event_description,
      });
    } else {
      this.events.set(name, {
        type: "dispatched",
        name,
        detail: default_detail,
        description: event_description,
      });
    }
  }

  /**
   * Parses custom types, events, slots, and other JSDoc annotations from component comments.
   *
   * Scans the entire source for JSDoc comment blocks and extracts structured information
   * about events, typedefs, slots, extends, restProps, and generics. Handles complex
   * description extraction logic that supports both inline descriptions and preceding
   * line descriptions.
   *
   * @example
   * ```ts
   * // Parses comments like:
   * /**
   *  * @event {CustomEvent} change - Fires when value changes
   *  * @property {string} value - The new value
   *  * @property {number} timestamp - When it changed
   *  *\/
   *
   * // Or:
   * /**
   *  * Description for the event
   *  * @event change
   *  *\/
   * ```
   */
  private parseCustomTypes() {
    if (!this.source) return;
    for (const { tags, description: commentDescription, source: blockSource } of parseComment(this.source, {
      spacing: "preserve",
    })) {
      let currentEventName: string | undefined;
      let currentEventType: string | undefined;
      let currentEventDescription: string | undefined;
      const eventProperties: Array<{
        name: string;
        type: string;
        description?: string;
        optional?: boolean;
        default?: string;
      }> = [];

      let currentTypedefName: string | undefined;
      let currentTypedefType: string | undefined;
      let currentTypedefDescription: string | undefined;
      const typedefProperties: Array<{
        name: string;
        type: string;
        description?: string;
        optional?: boolean;
        default?: string;
      }> = [];

      /**
       * Track if we've used the comment block description for any tag in this block.
       * Only the first tag (that needs a description) should use the comment block
       * description to avoid duplicating it across multiple tags.
       */
      let commentDescriptionUsed = false;
      let isFirstTag = true;

      /**
       * Build a map of line numbers to their description content (for lines without tags).
       * This allows us to find descriptions that appear on lines preceding tags.
       */
      const lineDescriptions = new Map<number, string>();
      /**
       * Track line numbers that contain tags so we can distinguish between
       * description lines and tag lines when looking backwards.
       */
      const tagLineNumbers = new Set<number>();
      for (const tagInfo of tags) {
        if (tagInfo.source && tagInfo.source.length > 0) {
          tagLineNumbers.add(tagInfo.source[0].number);
        }
      }
      for (const line of blockSource) {
        /**
         * Only track lines that have a description but no tag.
         * Also filter out lines that are just "}" (artifact from some comment formats
         * that may include closing braces in the description).
         */
        if (!line.tokens.tag && line.tokens.description && line.tokens.description.trim() !== "}") {
          lineDescriptions.set(line.number, line.tokens.description);
        }
      }

      /**
       * Helper to get the description from lines preceding a tag.
       *
       * Looks backwards from the tag until hitting another tag, collecting description
       * lines. Stops after finding the first contiguous block of description lines,
       * allowing blank lines to separate descriptions from tags.
       *
       * @param tagSource - The source information for the tag
       * @returns The concatenated description from preceding lines, or undefined
       *
       * @example
       * ```ts
       * // Comment structure:
       * /**
       *  * This is a description
       *  * that spans multiple lines
       *  *
       *  * @event change
       *  *\/
       * // getPrecedingDescription would return: "This is a description\nthat spans multiple lines"
       * ```
       */
      const getPrecedingDescription = (tagSource: typeof blockSource): string | undefined => {
        if (!tagSource || tagSource.length === 0) return undefined;
        const tagLineNumber = tagSource[0].number;

        /**
         * Look backwards from the tag line to find the immediately preceding description.
         * Collects description lines in order, stopping when we hit another tag or a
         * non-blank non-description line.
         */
        const descLines: string[] = [];
        let foundDescriptionBlock = false;

        for (let lineNum = tagLineNumber - 1; lineNum >= 1; lineNum--) {
          /**
           * Stop if we hit a tag line - descriptions belong to the nearest preceding tag.
           */
          if (tagLineNumbers.has(lineNum)) {
            break;
          }

          /**
           * Check if this line has a description and add it to our collection.
           * We unshift to maintain forward order when we reverse through the lines.
           */
          const desc = lineDescriptions.get(lineNum);
          if (desc) {
            descLines.unshift(desc);
            foundDescriptionBlock = true;
          } else if (foundDescriptionBlock) {
            /**
             * We've already found description lines and now hit a non-description line.
             * Check if it's blank - if so, continue (blank lines can separate descriptions
             * from tags); if not, stop here as we've reached the end of the description block.
             */
            const sourceLine = blockSource.find((l) => l.number === lineNum);
            const isBlank =
              !sourceLine ||
              (!sourceLine.tokens.tag &&
                (!sourceLine.tokens.description || sourceLine.tokens.description.trim() === ""));
            if (!isBlank) {
              /**
               * Non-blank non-description line - stop here as we've reached content
               * that's not part of the description.
               */
              break;
            }
            /**
             * Blank line - continue (blank lines can separate descriptions from tags
             * and are allowed in the description block).
             */
          }
          /**
           * If we haven't found any description yet, continue looking backwards
           * to find the description block.
           */
        }
        return descLines.length > 0 ? descLines.join("\n").trim() : undefined;
      };

      /**
       * Finalizes the current event being built and adds it to the events map.
       *
       * If the event has properties defined via `@property` tags, builds a detail type
       * from those properties. Otherwise, uses the type from `@type` tag or empty string.
       * Stores the event description for later use in forwarded event detection.
       *
       * @example
       * ```ts
       * // After processing:
       * // @event change
       * // @type {CustomEvent}
       * // @property {string} value
       * // finalizeEvent() creates:
       * // { type: "dispatched", name: "change", detail: "{ value: string }" }
       * ```
       */
      const finalizeEvent = () => {
        if (currentEventName !== undefined) {
          let detailType: string;
          if (eventProperties.length > 0) {
            detailType = this.buildEventDetailFromProperties(eventProperties, currentEventName, true);
          } else {
            detailType = currentEventType || "";
          }

          this.addDispatchedEvent({
            name: currentEventName,
            detail: detailType,
            has_argument: false,
            description: currentEventDescription,
          });
          this.eventDescriptions.set(currentEventName, currentEventDescription);
          eventProperties.length = 0;
          currentEventName = undefined;
          currentEventType = undefined;
          currentEventDescription = undefined;
        }
      };

      /**
       * Finalizes the current typedef being built and adds it to the typedefs map.
       *
       * Handles three cases:
       * 1. Properties defined via `@property` tags - builds an object type
       * 2. Inline type definition via `@typedef {type}` - uses the type directly
       * 3. No type specified - defaults to empty object type
       *
       * @example
       * ```ts
       * // Case 1: With properties
       * // @typedef User
       * // @property {string} name
       * // @property {number} age
       * // Result: type User = { name: string; age: number; }
       *
       * // Case 2: Inline type
       * // @typedef {string | number} ID
       * // Result: type ID = string | number
       *
       * // Case 3: No type
       * // @typedef Empty
       * // Result: type Empty = {}
       * ```
       */
      const finalizeTypedef = () => {
        if (currentTypedefName !== undefined) {
          let typedefType: string;
          let typedefTs: string;

          if (typedefProperties.length > 0) {
            /**
             * Build type alias with property descriptions from `@property` tags.
             * Use multiline formatting for better readability.
             */
            typedefType = this.buildEventDetailFromProperties(typedefProperties, undefined, true);
            typedefTs = `type ${currentTypedefName} = ${typedefType}`;
          } else if (currentTypedefType) {
            /**
             * Use inline type definition (existing behavior).
             * If the type ends with `}` or `};`, treat it as an interface body,
             * otherwise treat it as a type alias.
             */
            typedefType = currentTypedefType;
            typedefTs = TYPEDEF_END_REGEX.test(typedefType)
              ? `interface ${currentTypedefName} ${typedefType}`
              : `type ${currentTypedefName} = ${typedefType}`;
          } else {
            /**
             * No type or properties specified, default to empty object type.
             */
            typedefType = "{}";
            typedefTs = `type ${currentTypedefName} = ${typedefType}`;
          }

          this.typedefs.set(currentTypedefName, {
            type: typedefType,
            name: currentTypedefName,
            description: ComponentParser.assignValue(currentTypedefDescription),
            ts: typedefTs,
          });

          typedefProperties.length = 0;
          currentTypedefName = undefined;
          currentTypedefType = undefined;
          currentTypedefDescription = undefined;
        }
      };

      for (const {
        tag,
        type: tagType,
        name,
        description,
        optional,
        default: defaultValue,
        source: tagSource,
      } of tags) {
        const type = this.aliasType(tagType);
        /**
         * Get the description from the line immediately before this tag.
         * This supports the pattern where descriptions appear on lines preceding tags.
         */
        const precedingDescription = getPrecedingDescription(tagSource);

        switch (tag) {
          case "extends":
          case "extendProps":
            this.extends = {
              interface: name,
              import: type,
            };
            if (isFirstTag) isFirstTag = false;
            break;
          case "restProps": {
            /**
             * Prefer inline description (e.g., "@restProps {type} description" or "@restProps {type} - description"),
             * fall back to preceding line description, then fall back to the
             * comment block description (only for first tag if not already used).
             *
             * Note: comment-parser treats the first word after the type as "name" and the rest as "description",
             * so we combine them to form the full inline description for @restProps.
             */
            const rawInlineDesc = name ? (description ? `${name} ${description}` : name) : description;
            const inlineRestPropsDesc = cleanDescription(rawInlineDesc);
            let restPropsDesc = inlineRestPropsDesc || precedingDescription;
            if (!restPropsDesc && isFirstTag && !commentDescriptionUsed && commentDescription) {
              restPropsDesc = commentDescription;
              commentDescriptionUsed = true;
            }
            this.rest_props = {
              type: "Element",
              name: type,
              description: restPropsDesc || undefined,
            };
            if (isFirstTag) isFirstTag = false;
            break;
          }
          case "slot": {
            /**
             * Prefer inline description (e.g., "@slot name - description"),
             * fall back to preceding line description, then fall back to the
             * comment block description (only for first tag if not already used).
             */
            const inlineSlotDesc = cleanDescription(description);
            let slotDesc = inlineSlotDesc || precedingDescription;
            if (!slotDesc && isFirstTag && !commentDescriptionUsed && commentDescription) {
              slotDesc = commentDescription;
              commentDescriptionUsed = true;
            }
            if (isFirstTag) isFirstTag = false;
            this.addSlot({
              slot_name: name,
              slot_props: type,
              slot_description: slotDesc || undefined,
            });
            break;
          }
          case "event": {
            /**
             * Finalize any previous event being built before starting a new one.
             */
            finalizeEvent();

            /**
             * Start tracking new event with its name and type.
             * Prefer inline description (e.g., "@event {type} name - description"),
             * fall back to preceding line, then fall back to comment block description
             * (only for first tag if not already used).
             */
            currentEventName = name;
            currentEventType = type;
            const inlineEventDesc = cleanDescription(description);
            currentEventDescription = inlineEventDesc || precedingDescription;
            if (!currentEventDescription && isFirstTag && !commentDescriptionUsed && commentDescription) {
              currentEventDescription = commentDescription;
              commentDescriptionUsed = true;
            }
            if (isFirstTag) isFirstTag = false;
            break;
          }
          case "type":
            /**
             * Track the `@type` tag for the current event.
             * This allows specifying the event detail type separately from the `@event` tag.
             */
            if (currentEventName !== undefined) {
              currentEventType = type;
            }
            break;
          case "property": {
            /**
             * Collect properties for the current event or typedef.
             * Properties are accumulated until the event/typedef is finalized.
             */
            const propertyData = {
              name,
              type,
              description: cleanDescription(description),
              optional: optional || false,
              default: defaultValue,
            };

            if (currentEventName !== undefined) {
              eventProperties.push(propertyData);
            } else if (currentTypedefName !== undefined) {
              typedefProperties.push(propertyData);
            }
            break;
          }
          case "typedef": {
            /**
             * Finalize any previous typedef being built before starting a new one.
             */
            finalizeTypedef();

            /**
             * Start tracking new typedef with its name and type.
             * Prefer inline description, fall back to preceding line description,
             * then fall back to comment block description (only for first tag if not already used).
             */
            currentTypedefName = name;
            currentTypedefType = type;
            const inlineTypedefDesc = cleanDescription(description);
            currentTypedefDescription = inlineTypedefDesc || precedingDescription;
            if (!currentTypedefDescription && isFirstTag && !commentDescriptionUsed && commentDescription) {
              currentTypedefDescription = commentDescription;
              commentDescriptionUsed = true;
            }
            if (isFirstTag) isFirstTag = false;
            break;
          }
          case "generics":
            this.generics = [name, type];
            if (isFirstTag) isFirstTag = false;
            break;
        }
      }

      /**
       * Finalize any remaining event or typedef that wasn't closed by a new tag.
       * This handles cases where the comment block ends without starting a new event/typedef.
       */
      finalizeEvent();
      finalizeTypedef();
    }
  }

  /**
   * Builds an event detail type string from an array of property definitions.
   *
   * Creates an inline object type with JSDoc comments for each property,
   * including descriptions and default values. Used for both event details
   * and typedef property definitions.
   *
   * @param properties - Array of property definitions with name, type, description, etc.
   * @param _eventName - Optional event name (unused, kept for API consistency)
   * @returns A string representation of the object type with JSDoc comments
   *
   * @example
   * ```ts
   * // Input:
   * [
   *   { name: "value", type: "string", description: "The new value" },
   *   { name: "count", type: "number", optional: true, default: "0" }
   * ]
   *
   * // Output:
   * "{ /** The new value *\/ value: string; /** @default 0 *\/ count?: number; }"
   * ```
   */
  private buildEventDetailFromProperties(
    properties: Array<{ name: string; type: string; description?: string; optional?: boolean; default?: string }>,
    _eventName?: string,
    multiline = false,
  ): string {
    if (properties.length === 0) return "null";

    /**
     * Build inline object type with property descriptions as JSDoc comments.
     * Each property gets a JSDoc comment if it has a description or default value.
     */
    const props = properties
      .map(({ name, type, description, optional, default: defaultValue }) => {
        const optionalMarker = optional ? "?" : "";
        let comment = description || "";

        /**
         * Add default value to description if present.
         * If there's already a description, append the default; otherwise use only the default.
         */
        if (defaultValue && comment) {
          comment = `${comment} @default ${defaultValue}`;
        } else if (defaultValue) {
          comment = `@default ${defaultValue}`;
        }

        if (comment) {
          if (multiline) {
            return `/** ${comment} */\n  ${name}${optionalMarker}: ${type};`;
          }
          return `/** ${comment} */ ${name}${optionalMarker}: ${type};`;
        }
        return `${name}${optionalMarker}: ${type};`;
      })
      .join(multiline ? "\n  " : " ");

    return multiline ? `{\n  ${props}\n}` : `{ ${props} }`;
  }

  /**
   * Generates a TypeScript type name for a context key.
   *
   * Converts kebab-case, snake_case, or space-separated keys into PascalCase
   * with "Context" suffix. Splits on dashes, underscores, and spaces, then
   * capitalizes each part.
   *
   * @param key - The context key (e.g., "simple-modal", "tabs_context", "My Context")
   * @returns The generated type name (e.g., "SimpleModalContext", "TabsContext", "MyContextContext")
   *
   * @example
   * ```ts
   * generateContextTypeName("simple-modal")  // Returns: "SimpleModalContext"
   * generateContextTypeName("Tabs")           // Returns: "TabsContext"
   * generateContextTypeName("user_settings") // Returns: "UserSettingsContext"
   * generateContextTypeName("my context")    // Returns: "MyContextContext"
   * ```
   */
  private generateContextTypeName(key: string): string {
    const parts = key.split(CONTEXT_KEY_SPLIT_REGEX);
    const capitalized = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    return `${capitalized}Context`;
  }

  /**
   * Builds a cache of variable type information from JSDoc comments.
   *
   * Scans the source code for variable declarations and extracts type information
   * from preceding JSDoc comments. This cache is used to infer types for context
   * properties and other variable references.
   *
   * @example
   * ```ts
   * // Source code:
   * /**
   *  * @type {string}
   *  * The user's name
   *  *\/
   * const userName = "John";
   *
   * // Cache entry:
   * // { "userName": { type: "string", description: "The user's name" } }
   * ```
   */
  private buildVariableInfoCache() {
    if (!this.source) return;

    if (!this.sourceLinesCache) {
      this.sourceLinesCache = this.source.split("\n");
    }
    const lines = this.sourceLinesCache;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      /**
       * Match variable declarations (const, let, function) to find variables
       * that might have JSDoc type annotations.
       */
      const varMatch = line.match(VAR_DECLARATION_REGEX);
      if (varMatch) {
        const varName = varMatch[1];

        /**
         * Look backwards for JSDoc comment preceding this variable declaration.
         * Comments must be immediately before the declaration with no non-comment
         * lines in between.
         */
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j].trim();

          /**
           * Stop if we hit a non-comment, non-empty line - the comment is too far away.
           */
          if (prevLine && !prevLine.startsWith("*") && !prevLine.startsWith("/*") && !prevLine.startsWith("//")) {
            break;
          }

          /**
           * Found start of JSDoc comment - extract the entire comment block
           * and parse it to get type and description information.
           */
          if (prevLine.startsWith("/**")) {
            /**
             * Extract the JSDoc comment block from start to the line before the variable.
             */
            const commentLines: string[] = [];
            for (let k = j; k < i; k++) {
              commentLines.push(lines[k]);
            }
            const commentBlock = commentLines.join("\n");

            /**
             * Parse the JSDoc to extract `@type` tag and description.
             * Store in cache for later lookup.
             */
            const parsed = parseComment(commentBlock, { spacing: "preserve" });
            const { type: typeTag, description } = this.getCommentTags(parsed);
            if (typeTag) {
              this.variableInfoCache.set(varName, {
                type: this.aliasType(typeTag.type),
                description: description || typeTag.description,
              });
            }
            break;
          }
        }
      }
    }
  }

  /**
   * Cache for compiled regex patterns for variable name matching.
   *
   * Stores three regex patterns (const, let, function) per variable name
   * to avoid recreating them on each lookup. Improves performance when
   * searching for the same variable multiple times.
   */
  private static readonly VAR_NAME_REGEX_CACHE = new Map<string, [RegExp, RegExp, RegExp]>();

  /**
   * Gets or creates cached regex patterns for matching variable declarations.
   *
   * Creates three regex patterns for matching const, let, and function declarations
   * of a specific variable name. The patterns are cached to avoid recreating them
   * for the same variable name.
   *
   * @param varName - The variable name to create regex patterns for
   * @returns A tuple of three RegExp objects for const, let, and function patterns
   *
   * @example
   * ```ts
   * getVarNameRegexes("count")
   * // Returns:
   * // [
   * //   /\bconst\s+count\s*=/,
   * //   /\blet\s+count\s*=/,
   * //   /\bfunction\s+count\s*\(/
   * // ]
   * ```
   */
  private static getVarNameRegexes(varName: string): [RegExp, RegExp, RegExp] {
    let cached = ComponentParser.VAR_NAME_REGEX_CACHE.get(varName);
    if (!cached) {
      const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      cached = [
        new RegExp(`const\\s+${escaped}\\s*=`),
        new RegExp(`let\\s+${escaped}\\s*=`),
        new RegExp(`function\\s+${escaped}\\s*\\(`),
      ];
      ComponentParser.VAR_NAME_REGEX_CACHE.set(varName, cached);
    }
    return cached;
  }

  /**
   * Finds the type and description for a variable by searching for its JSDoc comment.
   *
   * First checks the cache built by {@link buildVariableInfoCache}. If not found,
   * searches the source code directly for the variable declaration and its
   * preceding JSDoc comment.
   *
   * @param varName - The variable name to look up
   * @returns The type and description if found, null otherwise
   *
   * @example
   * ```ts
   * // Source:
   * /**
   *  * @type {number}
   *  * The count value
   *  *\/
   * const count = 0;
   *
   * findVariableTypeAndDescription("count")
   * // Returns: { type: "number", description: "The count value" }
   * ```
   */
  private findVariableTypeAndDescription(varName: string): { type: string; description?: string } | null {
    const cached = this.variableInfoCache.get(varName);
    if (cached) {
      return cached;
    }

    /**
     * Search through the source code directly for JSDoc comments.
     * This is a fallback when the variable wasn't found in the cache.
     */
    if (!this.source) return null;

    if (!this.sourceLinesCache) {
      this.sourceLinesCache = this.source.split("\n");
    }
    const lines = this.sourceLinesCache;

    const [constRegex, letRegex, funcRegex] = ComponentParser.getVarNameRegexes(varName);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      /**
       * Check if this line declares our variable.
       * Match patterns like: const varName = ..., let varName = ..., function varName
       */
      const constMatch = line.match(constRegex);
      const letMatch = line.match(letRegex);
      const funcMatch = line.match(funcRegex);

      if (constMatch || letMatch || funcMatch) {
        /**
         * Look backwards for JSDoc comment preceding this variable declaration.
         */
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j].trim();

          /**
           * Stop if we hit a non-comment, non-empty line - the comment is too far away.
           */
          if (prevLine && !prevLine.startsWith("*") && !prevLine.startsWith("/*") && !prevLine.startsWith("//")) {
            break;
          }

          /**
           * Found start of JSDoc comment - extract and parse it.
           */
          if (prevLine.startsWith("/**")) {
            /**
             * Extract the JSDoc comment block from start to the line before the variable.
             */
            const commentLines: string[] = [];
            for (let k = j; k < i; k++) {
              commentLines.push(lines[k]);
            }
            const commentBlock = commentLines.join("\n");

            /**
             * Parse the JSDoc to extract `@type` tag and description.
             */
            const parsed = parseComment(commentBlock, { spacing: "preserve" });
            const { type: typeTag, description } = this.getCommentTags(parsed);
            if (typeTag) {
              return {
                type: this.aliasType(typeTag.type),
                description: description || typeTag.description,
              };
            }
            break;
          }
        }
      }
    }

    return null;
  }

  /**
   * Parses a context value from an AST node to extract type information.
   *
   * Handles two cases:
   * 1. ObjectExpression: Parses object literal properties and infers types from variable references
   * 2. Identifier: Looks up the variable's type from JSDoc comments
   *
   * @param node - The AST node representing the context value
   * @param key - The context key name
   * @returns A ComponentContext object with parsed properties, or null if parsing fails
   *
   * @example
   * ```ts
   * // Case 1: Object literal
   * // setContext('modal', { open, close })
   * // Returns: { key: "modal", typeName: "ModalContext", properties: [...] }
   *
   * // Case 2: Variable reference
   * // setContext('tabs', tabContext)
   * // Returns: { key: "tabs", typeName: "TabsContext", properties: [...] }
   * ```
   */
  private parseContextValue(node: Node, key: string): ComponentContext | null {
    if (!node || typeof node !== "object" || !("type" in node)) return null;

    if (node.type === "ObjectExpression") {
      /**
       * Parse object literal: { open, close }
       * Extract each property and try to infer its type from the variable it references.
       */
      const properties: ComponentContextProp[] = [];
      const objExpr = node as ObjectExpression;

      for (const prop of objExpr.properties) {
        if (prop.type === "Property") {
          const propObj = prop as Property;
          const propName =
            propObj.key && "name" in propObj.key
              ? (propObj.key as Identifier).name
              : propObj.key && "value" in propObj.key
                ? String((propObj.key as Literal).value)
                : undefined;
          if (!propName) continue;

          /**
           * Try to find the variable definition to get its JSDoc type.
           * If not found, default to "any" and optionally warn in verbose mode.
           */
          let propType = "any";
          let propDescription: string | undefined;

          if (propObj.value && typeof propObj.value === "object" && "type" in propObj.value) {
            if (propObj.value.type === "Identifier") {
              const varName = (propObj.value as Identifier).name;
              const varInfo = this.findVariableTypeAndDescription(varName);
              if (varInfo) {
                propType = varInfo.type;
                propDescription = varInfo.description;
              } else if (this.options?.verbose) {
                console.warn(`Warning: Context "${key}" property "${propName}" has no type annotation. Using "any".`);
              }
            } else if (
              propObj.value.type === "ArrowFunctionExpression" ||
              propObj.value.type === "FunctionExpression"
            ) {
              /**
               * Inline function - infer function type from parameters.
               * Parameters are typed as `any` since we don't have type information.
               */
              const funcExpr = propObj.value as ArrowFunctionExpression | FunctionExpression;
              const params =
                funcExpr.params
                  ?.map((p) => {
                    if (p && typeof p === "object" && "name" in p) {
                      return `${(p as Identifier).name || "arg"}: any`;
                    }
                    return "arg: any";
                  })
                  .join(", ") || "";
              propType = `(${params}) => any`;
            } else if (propObj.value.type === "Literal") {
              /**
               * Literal value - infer type from the literal's value type.
               */
              const literal = propObj.value as Literal;
              propType = literal.value == null ? "null" : typeof literal.value;
            }
          }

          properties.push({
            name: propName,
            type: propType,
            description: propDescription,
            optional: false,
          });
        }
      }

      return {
        key,
        typeName: this.generateContextTypeName(key),
        properties,
        description: undefined,
      };
    } else if (node.type === "Identifier") {
      /**
       * setContext('key', someVariable)
       * The context value is a direct variable reference.
       * Look up the variable's type from its JSDoc comment.
       */
      const ident = node as Identifier;
      const varName = ident.name;
      const varInfo = this.findVariableTypeAndDescription(varName);

      if (varInfo) {
        return {
          key,
          typeName: this.generateContextTypeName(key),
          properties: [
            {
              name: varName,
              type: varInfo.type,
              description: varInfo.description,
              optional: false,
            },
          ],
        };
      } else if (this.options?.verbose) {
        console.warn(`Warning: Context "${key}" variable "${varName}" has no type annotation. Using "any".`);
      }

      /**
       * Still create context with 'any' type even if we couldn't find type information.
       * This ensures the context is documented even without type annotations.
       */
      return {
        key,
        typeName: this.generateContextTypeName(key),
        properties: [
          {
            name: varName,
            type: "any",
            description: undefined,
            optional: false,
          },
        ],
      };
    }

    return null;
  }

  /**
   * Parses a `setContext` call expression to extract context information.
   *
   * Extracts the context key from the first argument (must be a string literal
   * or simple template literal) and the context value from the second argument.
   * Only processes static keys - dynamic keys are skipped with a warning.
   *
   * @param node - The AST node (should be a CallExpression)
   * @param _parent - The parent node (unused)
   *
   * @example
   * ```ts
   * // Parses: setContext('modal', { open, close })
   * // Extracts: key = "modal", value = { open, close }
   *
   * // Skips: setContext(dynamicKey, value) // key is not a literal
   * ```
   */
  private parseSetContextCall(node: Node, _parent?: Node) {
    /**
     * Extract context key (first argument).
     * Must be a CallExpression with at least one argument.
     */
    if (!node || typeof node !== "object" || !("type" in node) || node.type !== "CallExpression") {
      return;
    }
    const callExpr = node as CallExpression;
    const keyArg = callExpr.arguments[0];
    if (!keyArg) return;

    let contextKey: string | null = null;
    if (keyArg.type === "Literal") {
      const literal = keyArg as Literal;
      contextKey = typeof literal.value === "string" ? literal.value : String(literal.value);
    } else if (keyArg.type === "TemplateLiteral") {
      /**
       * Handle simple template literals (static strings only).
       * Dynamic template literals with expressions are skipped.
       */
      if (keyArg.quasis?.length === 1) {
        const cooked = keyArg.quasis[0].value.cooked;
        contextKey = cooked != null ? cooked : null;
      } else if (this.options?.verbose) {
        console.warn("Warning: Skipping setContext with dynamic template literal key");
      }
    } else if (this.options?.verbose) {
      console.warn(`Warning: Skipping setContext with non-literal key (type: ${keyArg.type})`);
    }

    if (!contextKey) return;

    /**
     * Extract context value (second argument).
     * This is parsed to extract type information from the value.
     */
    const valueArg = callExpr.arguments[1];
    if (!valueArg) return;

    /**
     * Parse the context object to extract properties and types.
     */
    const contextInfo = this.parseContextValue(valueArg, contextKey);
    if (contextInfo) {
      /**
       * Check if context with same key already exists.
       * If it does, warn and use the first occurrence (don't overwrite).
       */
      if (this.contexts.has(contextKey)) {
        if (this.options?.verbose) {
          console.warn(`Warning: Multiple setContext calls with key "${contextKey}". Using first occurrence.`);
        }
      } else {
        this.contexts.set(contextKey, contextInfo);
      }
    }
  }

  /**
   * Cleans up all parser state, resetting the instance for reuse.
   *
   * Clears all maps, caches, and resets all state variables to their initial
   * values. Should be called before parsing a new component or when the
   * parser instance needs to be reset.
   *
   * @example
   * ```ts
   * parser.parseSvelteComponent(source1, diagnostics1);
   * parser.cleanup(); // Reset state
   * parser.parseSvelteComponent(source2, diagnostics2); // Fresh parse
   * ```
   */
  public cleanup() {
    this.source = undefined;
    this.compiled = undefined;
    this.parsed = undefined;
    this.rest_props = undefined;
    this.extends = undefined;
    this.componentComment = undefined;
    this.reactive_vars.clear();
    this.props.clear();
    this.moduleExports.clear();
    this.slots.clear();
    this.events.clear();
    this.eventDescriptions.clear();
    this.forwardedEvents.clear();
    this.typedefs.clear();
    this.generics = null;
    this.bindings.clear();
    this.contexts.clear();
    this.variableInfoCache.clear();
    this.sourceLinesCache = undefined;
  }

  /**
   * Pre-compiled regex for matching script blocks in Svelte components.
   *
   * Matches `<script>` tags and their content, capturing the opening tag,
   * script content, and closing tag. Global and case-insensitive flags
   * allow matching multiple script blocks.
   *
   * @example
   * ```ts
   * // Matches:
   * // "<script>const x = 1;</script>"
   * // "<script lang='ts'>...</script>"
   * ```
   */
  private static readonly SCRIPT_BLOCK_REGEX = /(<script[^>]*>)([\s\S]*?)(<\/script>)/gi;

  /**
   * Pre-compiled regex for matching TypeScript directive comments.
   *
   * Matches TypeScript directive comments like ts-ignore, ts-expect-error,
   * etc. Used to remove these directives from script blocks before JSDoc parsing.
   *
   * @example
   * ```ts
   * // Matches:
   * // "// ts-ignore"
   * // "// ts-expect-error: reason"
   * // "// ts-nocheck"
   * ```
   */
  private static readonly TS_DIRECTIVE_REGEX = /\/\/\s*@ts-[^\n\r]*/g;

  /**
   * Strips TypeScript directive comments from script blocks only.
   *
   * Removes TypeScript directive comments (e.g., ts-ignore, ts-expect-error directives)
   * from within `<script>` blocks to prevent them from interfering with JSDoc parsing.
   * Directives outside script blocks are left untouched.
   *
   * @param source - The Svelte component source code
   * @returns The source code with TypeScript directives removed from script blocks
   *
   * @example
   * ```ts
   * // Input (with TypeScript directive):
   * <script>
   *   const x: string = 123; // directive removed
   * </script>
   *
   * // Output (directive stripped):
   * <script>
   *   const x: string = 123;
   * </script>
   * ```
   */
  private static stripTypeScriptDirectivesFromScripts(source: string): string {
    /**
     * Find all script blocks and strip directives only from within them.
     * Note: Need to reset lastIndex for global regex to ensure consistent matching.
     */
    ComponentParser.SCRIPT_BLOCK_REGEX.lastIndex = 0;
    return source.replace(ComponentParser.SCRIPT_BLOCK_REGEX, (_match, openTag, scriptContent, closeTag) => {
      /**
       * Remove TypeScript directives from script content only.
       * Preserves the script tags and other content outside script blocks.
       */
      ComponentParser.TS_DIRECTIVE_REGEX.lastIndex = 0;
      const cleanedContent = scriptContent.replace(ComponentParser.TS_DIRECTIVE_REGEX, "");
      return openTag + cleanedContent + closeTag;
    });
  }

  /**
   * Parses a Svelte component and extracts all component metadata.
   *
   * This is the main entry point that orchestrates the entire parsing process:
   * 1. Cleans up previous state
   * 2. Strips TypeScript directives that might interfere with JSDoc
   * 3. Compiles the component to get the AST
   * 4. Collects reactive variables
   * 5. Builds variable type cache
   * 6. Parses custom types from JSDoc comments
   * 7. Walks the AST to extract props, slots, events, bindings, and contexts
   * 8. Post-processes events to distinguish dispatched vs forwarded
   * 9. Processes props with bindings and slots with prop references
   * 10. Returns the complete parsed component structure
   *
   * @param source - The Svelte component source code
   * @param diagnostics - Diagnostic information (module name and file path)
   * @returns A ParsedComponent object containing all extracted metadata
   *
   * @example
   * ```ts
   * const parser = new ComponentParser();
   * const result = parser.parseSvelteComponent(source, {
   *   moduleName: "Button",
   *   filePath: "./Button.svelte"
   * });
   * // Returns: { props: [...], slots: [...], events: [...], ... }
   * ```
   */
  public parseSvelteComponent(source: string, diagnostics: ComponentParserDiagnostics): ParsedComponent {
    if (this.options?.verbose) {
      console.log(`[parsing] "${diagnostics.moduleName}" ${diagnostics.filePath}`);
    }

    this.cleanup();
    /**
     * Strip TypeScript directives from script blocks only to prevent interference with JSDoc.
     * TypeScript directive comments can break JSDoc parsing if not removed.
     */
    const cleanedSource = ComponentParser.stripTypeScriptDirectivesFromScripts(source);
    this.source = cleanedSource;

    /**
     * Parse once - compile() internally calls parse(), so we can extract the AST from it.
     * This avoids parsing the source twice for better performance.
     */
    const compiled = compile(cleanedSource);
    this.compiled = compiled;

    /**
     * Reuse the AST from compilation instead of parsing again.
     * The compile result includes the parsed AST, so we use that if available,
     * otherwise fall back to parsing directly.
     */
    this.parsed = compiled.ast || parse(cleanedSource);

    this.collectReactiveVars();
    this.sourceLinesCache = this.source.split("\n");
    this.buildVariableInfoCache();
    this.parseCustomTypes();

    if (this.parsed?.module) {
      walk(this.parsed?.module as unknown as Node, {
        enter: (node) => {
          if (node.type === "ExportNamedDeclaration") {
            /**
             * Skip re-exports (e.g., export { A, B } from 'library').
             * These don't have declarations in the current file, so we can't extract metadata.
             */
            if (node.declaration == null) {
              return;
            }

            /**
             * Handle both VariableDeclaration and FunctionDeclaration exports.
             * Both can be exported from the module script and need type extraction.
             */
            if (!node.declaration || typeof node.declaration !== "object" || !("type" in node.declaration)) {
              return;
            }

            let prop_name: string;
            let kind: "let" | "const" | "function";
            let description: string | undefined;
            let isFunctionDeclaration = false;
            let value: string | undefined;
            let type: string | undefined;
            let isFunction = false;
            let params: ComponentPropParam[] | undefined;
            let returnType: string | undefined;

            if (node.declaration.type === "FunctionDeclaration") {
              const funcDecl = node.declaration as { id?: { name?: string } };
              if (!funcDecl.id || !funcDecl.id.name) return;
              prop_name = funcDecl.id.name;
              kind = "function";
              value = undefined;
              type = "() => any";
              isFunction = true;
              isFunctionDeclaration = true;
            } else if (node.declaration.type === "VariableDeclaration") {
              const varDecl = node.declaration as VariableDeclaration;
              const firstDeclarator = varDecl.declarations[0];
              if (!firstDeclarator || typeof firstDeclarator !== "object" || !("id" in firstDeclarator)) {
                return;
              }

              const { id, init } = firstDeclarator as VariableDeclarator;

              if (!id || typeof id !== "object" || !("name" in id)) {
                return;
              }

              prop_name = (id as Identifier).name;
              /**
               * VariableDeclaration.kind can be "var" | "let" | "const", but ComponentProp.kind
               * is "let" | "const" | "function". Convert "var" to "let" for compatibility
               * since "var" is not a valid prop kind in Svelte components.
               */
              kind = varDecl.kind === "var" ? "let" : varDecl.kind;
              const initResult = init != null ? this.processInitializer(init) : { isFunction: false };
              ({ value, type, isFunction } = initResult);
            } else {
              return;
            }

            if (node.leadingComments) {
              const jsdocInfo = this.processJSDocComment(node.leadingComments);
              if (jsdocInfo) {
                if (jsdocInfo.type) type = jsdocInfo.type;
                params = jsdocInfo.params;
                returnType = jsdocInfo.returnType;
                if (jsdocInfo.description) description = jsdocInfo.description;
              }
            }

            // Merge returnType into type for function declarations if not overridden by @type
            if (isFunctionDeclaration && type === "() => any" && returnType) {
              if (params && params.length > 0) {
                const paramStrings = params.map((param) => {
                  const optional = param.optional ? "?" : "";
                  return `${param.name}${optional}: ${param.type}`;
                });
                const paramsString = paramStrings.join(", ");
                type = `(${paramsString}) => ${returnType}`;
              } else {
                type = `() => ${returnType}`;
              }
            }

            if (!description && type && this.typedefs.has(type)) {
              description = this.typedefs.get(type)?.description;
            }

            this.addModuleExport(prop_name, {
              name: prop_name,
              kind,
              description,
              type,
              value,
              params,
              returnType,
              isFunction,
              isFunctionDeclaration,
              isRequired: false,
              constant: kind === "const",
              reactive: false,
            });
          }
        },
      });
    }

    let dispatcher_name: undefined | string;
    const callees: { name: string; arguments: Array<Expression | unknown> }[] = [];

    walk({ html: this.parsed.html, instance: this.parsed.instance } as unknown as Node, {
      enter: (node, parent, _prop) => {
        if (node.type === "CallExpression") {
          const callExpr = node as CallExpression;
          const calleeName =
            callExpr.callee && typeof callExpr.callee === "object" && "name" in callExpr.callee
              ? (callExpr.callee as Identifier).name
              : undefined;

          if (calleeName === "createEventDispatcher") {
            if (
              parent &&
              typeof parent === "object" &&
              "id" in parent &&
              parent.id &&
              typeof parent.id === "object" &&
              "name" in parent.id
            ) {
              dispatcher_name = (parent.id as Identifier).name;
            }
          }

          if (calleeName === "setContext") {
            this.parseSetContextCall(node, parent ?? undefined);
          }

          if (calleeName) {
            callees.push({
              name: calleeName,
              arguments: callExpr.arguments,
            });
          }
        }

        /**
         * Check for Spread node (Svelte-specific AST node type).
         * Note: Spread is a Svelte-specific type not in estree, so we check the string value.
         * This handles `{...$$restProps}` spread syntax in component templates.
         */
        if (node && typeof node === "object" && "type" in node && String(node.type) === "Spread") {
          const spreadNode = node as { type: string; expression?: { name?: string } };
          if (spreadNode.expression?.name === "$$restProps") {
            /**
             * Check if parent is InlineComponent or Element (Svelte-specific types).
             * Rest props can only be spread on components or elements.
             */
            if (
              parent &&
              typeof parent === "object" &&
              "type" in parent &&
              ((parent.type as string) === "InlineComponent" || (parent.type as string) === "Element")
            ) {
              const parentType = parent.type as string;
              const parentName = "name" in parent && typeof parent.name === "string" ? parent.name : undefined;
              if (parentName) {
                const restProps: RestProps =
                  parentType === "InlineComponent"
                    ? {
                        type: "InlineComponent",
                        name: parentName,
                      }
                    : {
                        type: "Element",
                        name: parentName,
                      };

                /**
                 * Handle svelte:element - check if this attribute is hardcoded.
                 * The 'this' value is stored in the 'tag' property of the Element node.
                 * If tag is a string, it's hardcoded; if undefined/null, it's dynamic.
                 */
                if (parentType === "Element" && parentName === "svelte:element") {
                  if ("tag" in parent && typeof parent.tag === "string") {
                    (restProps as ComponentElement).thisValue = parent.tag;
                  }
                  /**
                   * If tag is undefined or not a string, thisValue remains undefined (dynamic).
                   */
                }

                /**
                 * Only set rest_props from AST if not already set by `@restProps` annotation.
                 * The annotation takes precedence as it can specify union types like "ul | ol"
                 * which can't be inferred from the AST alone.
                 */
                if (this.rest_props === undefined) {
                  this.rest_props = restProps;
                }
              }
            }
          }
        }

        if (node.type === "VariableDeclaration") {
          this.vars.add(node as unknown as VariableDeclaration);
        }

        if (node.type === "ExportNamedDeclaration") {
          /**
           * Handle export {} - empty export statement, nothing to extract.
           */
          if (node.declaration == null && node.specifiers.length === 0) {
            return;
          }

          /**
           * Handle renamed exports (e.g., export { localName as exportedName }).
           * We need to find the original declaration and use the exported name as the prop name.
           */
          let prop_name: string;
          if (node.declaration == null && node.specifiers[0]?.type === "ExportSpecifier") {
            const specifier = node.specifiers[0];
            const localName =
              specifier.local && typeof specifier.local === "object" && "name" in specifier.local
                ? (specifier.local as Identifier).name
                : undefined;
            const exportedName =
              specifier.exported && typeof specifier.exported === "object" && "name" in specifier.exported
                ? (specifier.exported as Identifier).name
                : undefined;
            if (!localName || !exportedName) return;
            let declaration: VariableDeclaration | undefined;
            /**
             * Search through all variable declarations for this variable.
             * Limitation: the variable must have been declared before the export
             * since we're walking the AST in order.
             */
            for (const varDecl of Array.from(this.vars)) {
              if (
                varDecl.declarations.some(
                  (decl) =>
                    decl.id &&
                    typeof decl.id === "object" &&
                    "type" in decl.id &&
                    decl.id.type === "Identifier" &&
                    (decl.id as Identifier).name === localName,
                )
              ) {
                declaration = varDecl;
                break;
              }
            }
            node.declaration = declaration;
            prop_name = exportedName;
          }

          /**
           * Skip re-exports (e.g., export { A, B } from 'library').
           * These don't have declarations in the current file.
           */
          if (node.declaration == null) {
            return;
          }

          /**
           * Handle both VariableDeclaration and FunctionDeclaration.
           * Both can be exported as props from the component.
           */
          if (!node.declaration || typeof node.declaration !== "object" || !("type" in node.declaration)) {
            return;
          }

          let kind: "let" | "const" | "function";
          let description: undefined | string;
          let isFunctionDeclaration = false;
          let value: string | undefined;
          let type: string | undefined;
          let isFunction = false;
          let params: ComponentPropParam[] | undefined;
          let returnType: string | undefined;
          let isRequired = false;

          if (node.declaration.type === "FunctionDeclaration") {
            const funcDecl = node.declaration as { id?: { name?: string } };
            if (!funcDecl.id || !funcDecl.id.name) return;
            prop_name ??= funcDecl.id.name;
            kind = "function";
            value = undefined;
            type = "() => any";
            isFunction = true;
            isFunctionDeclaration = true;
            isRequired = false;
          } else if (node.declaration.type === "VariableDeclaration") {
            const varDecl = node.declaration as VariableDeclaration;
            const firstDeclarator = varDecl.declarations[0];
            if (!firstDeclarator || typeof firstDeclarator !== "object" || !("id" in firstDeclarator)) {
              return;
            }

            const { id, init } = firstDeclarator as VariableDeclarator;

            if (id && typeof id === "object" && "name" in id) {
              prop_name ??= (id as Identifier).name;
            } else {
              return;
            }

            /**
             * VariableDeclaration.kind can be "var" | "let" | "const", but ComponentProp.kind
             * is "let" | "const" | "function". Convert "var" to "let" for compatibility
             * since "var" is not a valid prop kind in Svelte components.
             */
            kind = varDecl.kind === "var" ? "let" : varDecl.kind;
            isRequired = kind === "let" && init == null;
            const initResult = init != null ? this.processInitializer(init) : { isFunction: false };
            ({ value, type, isFunction } = initResult);
          } else {
            return;
          }

          if (node.leadingComments) {
            const jsdocInfo = this.processJSDocComment(node.leadingComments);
            if (jsdocInfo) {
              if (jsdocInfo.type) type = jsdocInfo.type;
              params = jsdocInfo.params;
              returnType = jsdocInfo.returnType;
              if (jsdocInfo.description) description = jsdocInfo.description;
            }
          }

          // Merge returnType into type for function declarations if not overridden by @type
          if (isFunctionDeclaration && type === "() => any" && returnType) {
            if (params && params.length > 0) {
              const paramStrings = params.map((param) => {
                const optional = param.optional ? "?" : "";
                return `${param.name}${optional}: ${param.type}`;
              });
              const paramsString = paramStrings.join(", ");
              type = `(${paramsString}) => ${returnType}`;
            } else {
              type = `() => ${returnType}`;
            }
          }

          if (!description && type && this.typedefs.has(type)) {
            description = this.typedefs.get(type)?.description;
          }

          this.addProp(prop_name, {
            name: prop_name,
            kind,
            description,
            type,
            value,
            params,
            returnType,
            isFunction,
            isFunctionDeclaration,
            isRequired,
            constant: kind === "const",
            reactive: this.reactive_vars.has(prop_name),
          });
        }

        /**
         * Check for Comment node (Svelte-specific AST node type).
         * Looks for HTML comments in the template that start with `@component`.
         */
        if (node && typeof node === "object" && "type" in node && String(node.type) === "Comment") {
          const commentNode = node as { data?: string };
          const data: string = commentNode?.data?.trim() ?? "";

          if (COMPONENT_COMMENT_REGEX.test(data)) {
            this.componentComment = data.replace(COMPONENT_COMMENT_REGEX, "").replace(CARRIAGE_RETURN_REGEX, "");
          }
        }

        /**
         * Check for Slot node (Svelte-specific AST node type).
         * Extracts slot definitions from the template, including named slots,
         * slot props, and fallback content.
         */
        if (node && typeof node === "object" && "type" in node && String(node.type) === "Slot") {
          const slotNode = node as {
            attributes?: Array<{
              name?: string;
              value?: Array<{
                type?: string;
                expression?: unknown;
                raw?: string;
                start?: number;
                end?: number;
                data?: string;
              }>;
            }>;
            children?: Array<{ start?: number; end?: number }>;
          };
          const slot_name = slotNode.attributes?.find((attr) => attr.name === "name")?.value?.[0]?.data;

          const slot_props = (slotNode.attributes || [])
            .filter((attr) => attr.name !== "name")
            .reduce<SlotProps>((slot_props, attr) => {
              const slot_prop_value: SlotPropValue = {
                value: undefined,
                replace: false,
              };

              const value = attr.value;
              if (value === undefined) return slot_props;

              if (value[0]) {
                const firstValue = value[0];
                const { type, expression, raw, start, end } = firstValue;

                if (type === "Text" && raw !== undefined) {
                  slot_prop_value.value = raw;
                } else if (
                  type === "AttributeShorthand" &&
                  expression &&
                  typeof expression === "object" &&
                  "name" in expression
                ) {
                  slot_prop_value.value = (expression as Identifier).name;
                  slot_prop_value.replace = true;
                }

                if (expression && typeof expression === "object" && "type" in expression) {
                  if (expression.type === "Literal" && "value" in expression) {
                    slot_prop_value.value = String((expression as Literal).value);
                  } else if (expression.type === "MemberExpression") {
                    slot_prop_value.value = this.resolveMemberExpressionType(expression);
                  } else if (expression.type !== "Identifier") {
                    if (start !== undefined && end !== undefined) {
                      if (expression.type === "ObjectExpression" || expression.type === "TemplateLiteral") {
                        slot_prop_value.value = this.sourceAtPos(start + 1, end - 1);
                      }
                    }
                  }
                }
              }

              if (attr.name) {
                slot_props[attr.name] = slot_prop_value;
              }
              return slot_props;
            }, {});

          const fallback = (slotNode.children as TemplateNode[] | undefined)
            ?.map(({ start, end }) => this.sourceAtPos(start, end))
            .join("")
            .trim();

          this.addSlot({
            slot_name,
            slot_props: JSON.stringify(slot_props, null, 2),
            slot_fallback: fallback,
          });
        }

        /**
         * Check for EventHandler node (Svelte-specific AST node type).
         * Handles event forwarding syntax like `<Component on:click />` or `<button on:click />`.
         * When an event handler has no expression, it means the event is being forwarded.
         */
        if (node && typeof node === "object" && "type" in node && String(node.type) === "EventHandler") {
          const eventHandlerNode = node as { expression?: unknown; name?: string };
          if (eventHandlerNode.expression == null && eventHandlerNode.name) {
            if (parent != null && typeof parent === "object" && "name" in parent) {
              const parentName = typeof parent.name === "string" ? parent.name : undefined;
              const parentType = "type" in parent ? String(parent.type) : undefined;
              if (parentName && parentType) {
                /**
                 * Determine if parent is InlineComponent or Element.
                 * This tells us whether the event is forwarded from a component or native element.
                 */
                const element: ComponentInlineElement | ComponentElement =
                  parentType === "InlineComponent"
                    ? { type: "InlineComponent", name: parentName }
                    : { type: "Element", name: parentName };

                /**
                 * Track that this event is forwarded (we'll use this info later).
                 * This helps distinguish between dispatched and forwarded events during post-processing.
                 */
                this.forwardedEvents.set(eventHandlerNode.name, element);

                const existing_event = this.events.get(eventHandlerNode.name);

                /**
                 * Check if this event has a JSDoc description from `@event` tags.
                 */
                const description = this.eventDescriptions.get(eventHandlerNode.name);
                const event_description = extractDescriptionAfterDash(description);

                if (!existing_event) {
                  /**
                   * Add new forwarded event to the events map.
                   */
                  this.events.set(eventHandlerNode.name, {
                    type: "forwarded",
                    name: eventHandlerNode.name,
                    element: element,
                    description: event_description,
                  });
                } else if (existing_event.type === "forwarded" && event_description && !existing_event.description) {
                  /**
                   * Event is already forwarded, just add the description if it wasn't set before.
                   */
                  this.events.set(eventHandlerNode.name, {
                    ...existing_event,
                    description: event_description,
                  });
                }
                /**
                 * Note: if event is dispatched, we don't overwrite it here.
                 * We'll handle @event JSDoc on forwarded events after the walk completes
                 * to correctly convert dispatched events that are actually forwarded.
                 */
              }
            }
          }
        }

        /**
         * Check for Binding node (Svelte-specific AST node type).
         * Handles element bindings like `bind:this={elementRef}` which change the
         * prop type to include the element type (e.g., `HTMLButtonElement | null`).
         */
        if (
          parent &&
          typeof parent === "object" &&
          "type" in parent &&
          String(parent.type) === "Element" &&
          node &&
          typeof node === "object" &&
          "type" in node &&
          String(node.type) === "Binding"
        ) {
          const bindingNode = node as { name?: string; expression?: { name?: string } };
          const parentElement = parent as { name?: string };
          if (bindingNode.name === "this" && bindingNode.expression?.name && parentElement.name) {
            const prop_name = bindingNode.expression.name;
            const element_name = parentElement.name;

            if (this.bindings.has(prop_name)) {
              const existing_bindings = this.bindings.get(prop_name);

              if (existing_bindings && !existing_bindings.elements.includes(element_name)) {
                this.bindings.set(prop_name, {
                  ...existing_bindings,
                  elements: [...existing_bindings.elements, element_name],
                });
              }
            } else {
              this.bindings.set(prop_name, {
                elements: [element_name],
              });
            }
          }
        }
      },
    });

    if (dispatcher_name !== undefined) {
      for (const callee of callees) {
        if (callee.name === dispatcher_name) {
          const firstArg = callee.arguments[0];
          const event_name =
            firstArg && typeof firstArg === "object" && "value" in firstArg ? (firstArg as Literal).value : undefined;
          const event_argument = callee.arguments[1];
          const event_detail =
            event_argument && typeof event_argument === "object" && "value" in event_argument
              ? (event_argument as Literal).value
              : undefined;

          if (event_name != null) {
            this.addDispatchedEvent({
              name: String(event_name),
              detail: event_detail != null ? String(event_detail) : "",
              has_argument: Boolean(event_argument),
            });
          }
        }
      }
    }

    /**
     * Post-process events: convert dispatched events from @event JSDoc to forwarded events
     * if they are actually forwarded and not dispatched via createEventDispatcher.
     *
     * This handles the case where an event is documented with @event but is actually
     * forwarded via `on:eventname` syntax rather than dispatched. We need to check
     * which events are actually dispatched and convert the rest to forwarded events.
     */
    const actuallyDispatchedEvents = new Set<string>();
    if (dispatcher_name !== undefined) {
      for (const callee of callees) {
        if (callee.name === dispatcher_name) {
          const firstArg = callee.arguments[0];
          const eventName =
            firstArg && typeof firstArg === "object" && "value" in firstArg ? (firstArg as Literal).value : undefined;
          if (eventName != null) {
            actuallyDispatchedEvents.add(String(eventName));
          }
        }
      }
    }

    this.forwardedEvents.forEach((element, eventName) => {
      const event = this.events.get(eventName);
      /**
       * If event is marked as dispatched but is NOT actually dispatched, convert it to forwarded.
       * This happens when @event JSDoc is used but the event is actually forwarded via on: syntax.
       */
      if (event && event.type === "dispatched" && !actuallyDispatchedEvents.has(eventName)) {
        const description = this.eventDescriptions.get(eventName);
        const event_description = extractDescriptionAfterDash(description);
        const forwardedEvent: ForwardedEvent = {
          type: "forwarded",
          name: eventName,
          element: element,
          description: event_description,
        };
        /**
         * Preserve detail type if it was explicitly set in `@event` tag.
         * Note: "null" is a valid explicit type (e.g., `@event {null} eventname`).
         * Only skip if detail is truly undefined or the string "undefined".
         */
        if (event.detail !== undefined && event.detail !== "undefined") {
          forwardedEvent.detail = event.detail;
        }
        this.events.set(eventName, forwardedEvent);
      }
    });

    const processedProps = ComponentParser.mapToArray(this.props).map((prop) => {
      if (this.bindings.has(prop.name)) {
        const elementTypes = this.bindings
          .get(prop.name)
          ?.elements.sort()
          .map((element) => getElementByTag(element))
          .join(" | ");
        return {
          ...prop,
          type: `null | ${elementTypes}`,
        };
      }

      return prop;
    });

    const processedSlots = ComponentParser.mapToArray(this.slots)
      .map((slot) => {
        try {
          if (!slot.slot_props) {
            return slot;
          }
          const slot_props: SlotProps = JSON.parse(slot.slot_props);
          const new_props: string[] = [];

          for (const key of Object.keys(slot_props)) {
            if (slot_props[key].replace && slot_props[key].value !== undefined) {
              slot_props[key].value = this.props.get(slot_props[key].value)?.type;
            }

            if (slot_props[key].value === undefined) slot_props[key].value = "any";
            new_props.push(`${key}: ${slot_props[key].value}`);
          }

          const formatted_slot_props = new_props.length === 0 ? "Record<string, never>" : `{ ${new_props.join(", ")} }`;

          return { ...slot, slot_props: formatted_slot_props };
        } catch (_e) {
          return slot;
        }
      })
      .sort((a, b) => {
        const aName = a.name ?? "";
        const bName = b.name ?? "";
        if (aName < bName) return -1;
        if (aName > bName) return 1;
        return 0;
      });

    const moduleExportsArray = ComponentParser.mapToArray(this.moduleExports);
    /**
     * Transform events for JSON serialization: convert element object to string for backward compatibility.
     * The internal representation uses element objects, but JSON output uses strings for compatibility
     * with older versions of sveld and external tools.
     */
    const eventsArray = ComponentParser.mapToArray(this.events).map((event): SerializedComponentEvent => {
      if (event.type === "forwarded") {
        return {
          ...event,
          element: event.element.name,
        };
      }
      return event;
    });
    const typedefsArray = ComponentParser.mapToArray(this.typedefs);
    const contextsArray = ComponentParser.mapToArray(this.contexts);

    return {
      props: processedProps,
      moduleExports: moduleExportsArray,
      slots: processedSlots,
      events: eventsArray as ComponentEvent[], // Type assertion: serialized format for JSON, but typed as ComponentEvent for API
      typedefs: typedefsArray,
      generics: this.generics,
      rest_props: this.rest_props,
      extends: this.extends,
      componentComment: this.componentComment,
      contexts: contextsArray,
    };
  }
}
