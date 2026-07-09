import { parse as parseComment } from "comment-parser";
import type {
  AssignmentExpression,
  CallExpression,
  Expression,
  FunctionDeclaration,
  Identifier,
  Literal,
  MemberExpression,
  ObjectExpression,
  Property,
  UpdateExpression,
  VariableDeclaration,
  VariableDeclarator,
} from "estree";
import type { Node } from "estree-walker";
import { walk } from "estree-walker";
import { compile, parse } from "svelte/compiler";
import {
  isCallExpressionNamed,
  isIdentifier,
  isLiteral,
  isMemberExpression,
  unwrapTypeCastExpression,
} from "./ast-guards";
import type { SveldDiagnostic } from "./diagnostics";
import { getElementByTag } from "./element-tag-map";
import { resolveMemberExpressionType } from "./parser/bindings";
import { createParserContext, type ParserContext } from "./parser/context";
import { parseSetContextCall } from "./parser/contexts";
import { recordDiagnostic } from "./parser/diagnostics";
import { addDispatchedEvent, literalDetailToTypeText, parseHostDispatchEventCall } from "./parser/events";
import { parseGenericsAttribute } from "./parser/generics";
import { getCommentTags, parseCustomTypes, processNodeJSDoc } from "./parser/jsdoc";
import { addProp, processInitializer } from "./parser/props";
import { maybeSetRestProps } from "./parser/rest-props";
import {
  buildRunesPropTypeMetadata,
  normalizeRunesCallbackProps,
  parseRunesPropsDeclaration,
} from "./parser/runes-props";
import {
  createScopeWalkState,
  enterNestedScopeDeclarationNode,
  initComponentScope,
  leaveNestedScopeDeclarationNode,
  markReactivePropsFromMutationTarget,
  resolveIdentifierToReactiveProp,
} from "./parser/scopes";
import { addSlot, buildSlotPropsFromObjectExpression, extractRenderTagInfo } from "./parser/slots";
import { sourceAtPos, sourceRangeFromNode, sourceRangeFromOffsets } from "./parser/source-position";
import { buildTypeScriptMetadata } from "./parser/type-resolution";

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

/** Returns `value`, or `undefined` when it's `undefined` or the empty string. */
export function assignValue(value?: "" | string) {
  return value === undefined || value === "" ? undefined : value;
}

/** Structured JSDoc tag (e.g. `{ name: "since", body: "1.2.0" }`). */
export interface JsDocPassthroughTag {
  name: string;
  body: string;
}

/**
 * From `@deprecated` JSDoc: a message string, or `true` when the tag has no message.
 */
export type DeprecatedValue = string | true;

/**
 * Maps ESTree `VariableDeclaration.kind` to `ComponentProp.kind`.
 * `var` becomes `let` for Svelte-oriented output; `using` / `await using`
 * map to `const` (single binding, not a valid Svelte prop keyword).
 */
function variableDeclarationKindToComponentPropKind(kind: VariableDeclaration["kind"]): "let" | "const" {
  if (kind === "var") return "let";
  if (kind === "using" || kind === "await using") return "const";
  return kind;
}

export interface LegacyAstRoot {
  module?: Node;
  html?: Node;
  instance?: Node;
}

export interface SourcePosition {
  /** 1-based source line number */
  line: number;
  /** 0-based source column number */
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export interface RunesPropTypeMetadata {
  optional: boolean;
  source?: SourceRange;
  type: string;
}

export interface RunesPropsDeclarationMetadata {
  canonicalType?: string;
  props: Map<string, RunesPropTypeMetadata>;
  referencedImportedTypes: Set<string>;
  referencedLocalTypes: Set<string>;
}

export type ModernRunesTypeNode = {
  type?: string;
  id?: { name?: string };
  start?: number;
  end?: number;
  body?: { body?: ModernRunesTypeMember[] };
  typeAnnotation?: ModernRunesTypeNode;
  typeName?: unknown;
  types?: ModernRunesTypeNode[];
  members?: ModernRunesTypeMember[];
};

export type ModernRunesTypeMember = {
  type?: string;
  computed?: boolean;
  optional?: boolean;
  start?: number;
  end?: number;
  key?: Property["key"];
  typeAnnotation?: {
    start?: number;
    end?: number;
    typeAnnotation?: ModernRunesTypeNode;
  };
};

type TemplateNode = { start?: number; end?: number };

export interface TypeImportBinding {
  importedName?: string;
  localName: string;
  source: string;
  specifierType: "default" | "named" | "namespace";
}

export interface LocalTypeDeclaration {
  code: string;
  node: ModernRunesTypeNode;
  start: number;
}

export interface ParsedComponentTypeScriptMetadata {
  canonicalPropsType?: string;
  canonicalPropNames: string[];
  localTypeDeclarations: string[];
  typeImportStatements: string[];
  /**
   * Whether `canonicalPropsType` mentions one of the component's own
   * `<script generics="...">` parameters (e.g. `Props<T>`). The semantic
   * resolver has no binding for `T`, so `resolveTypes` must leave this
   * component's props as their AST-derived text rather than expand them.
   */
  referencesComponentGenerics?: boolean;
}

export const PARSED_COMPONENT_TYPE_SCRIPT_METADATA = Symbol("sveld.parsedComponentTypeScriptMetadata");

export function getParsedComponentTypeScriptMetadata(component: {
  [PARSED_COMPONENT_TYPE_SCRIPT_METADATA]?: ParsedComponentTypeScriptMetadata;
}) {
  return component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA];
}

/** One prop returned by the TypeScript checker during `resolveTypes`. */
export interface ResolvedComponentProp {
  name: string;
  type: string;
  isRequired: boolean;
  description?: string;
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

export type SyntaxMode = "legacy" | "runes";
export type ScriptLanguage = "js" | "ts";
export type ScopeBindingKind = "prop" | "local";
export type ScopeBinding = { kind: ScopeBindingKind; publicPropName?: string };
export type LexicalScope = Map<string, ScopeBinding>;
export type ComponentPropTypeSource = "typescript" | "jsdoc" | "default" | "inferred" | "unknown";
export type ComponentPropDefaultValueKind = "literal" | "array" | "object" | "expression" | "function" | "unknown";

export interface ComponentPropDefaultValue {
  raw: string;
  kind: ComponentPropDefaultValueKind;
  value?: unknown;
}

export interface ProcessedInitializer {
  value?: string;
  type?: string;
  isFunction: boolean;
  defaultValue?: ComponentPropDefaultValue;
  /** JSDoc from identifier default when the prop has none. */
  resolvedType?: string;
  resolvedDescription?: string;
  resolvedParams?: ComponentPropParam[];
  resolvedReturnType?: string;
}

type ModernScriptAttribute = {
  name?: string;
  value?: Array<{ data?: string; raw?: string }> | boolean;
  start?: number;
  end?: number;
};

export type ModernScriptNode = {
  attributes?: ModernScriptAttribute[];
};

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

export type ComponentPropBinding = "readonly" | "writable";

/**
 * Parameter information for function props.
 *
 * Extracted from JSDoc `@param` tags to provide detailed function signatures.
 */
export interface ComponentPropParam {
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
export interface ComponentProp {
  /** The prop name as declared in the component */
  name: string;
  /** The declaration kind: "let" (required), "const" (optional with default), or "function" */
  kind: "let" | "const" | "function";
  /** Whether this prop is declared as `const` (has a default value) */
  constant: boolean;
  /** The TypeScript type of the prop (e.g., "string", "number | string") */
  type?: string;
  /** Conservative provenance for the prop type */
  typeSource?: ComponentPropTypeSource;
  /** Local variable name, emitted when it differs from the public prop name */
  localName?: string;
  /** The default value as a string representation of the source code */
  value?: string;
  /** Structured default value metadata for docs UIs */
  defaultValue?: ComponentPropDefaultValue;
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
  /** Explicit author-documented binding direction from `@bindable` JSDoc */
  binding?: ComponentPropBinding;
  /** True when the prop is explicitly declared with Svelte 5 `$bindable()` */
  bindable?: true;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** Structured `@since` / `@example` tags, in source order. */
  tags?: JsDocPassthroughTag[];
  /** Source range for the prop declaration, when available */
  source?: SourceRange;
}

/**
 * Default slot name constant.
 *
 * Used to represent the default (unnamed) slot in Svelte components.
 * The default slot is accessed without a name attribute.
 */
const DEFAULT_SLOT_NAME = null;

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

/** Matches a JSDoc `@slot`/`@snippet` type of an empty object literal, e.g. `{{}}` or `{{ }}`. */
const EMPTY_OBJECT_TYPE_REGEX = /^\{\s*\}$/;

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
const _NEWLINE_CR_REGEX = /[\r\n]+/g;

/**
 * Component slot definition.
 *
 * Represents a slot that can be used to pass content into the component.
 * Includes information about slot props, fallback content, and descriptions.
 */
export interface ComponentSlot {
  /** The slot name (null or undefined for default slot) */
  name?: string | null;
  /** Whether this is the default slot */
  default: boolean;
  /** Fallback content to display when slot is not provided */
  fallback?: string;
  /** TypeScript type definition for slot props (e.g., "{ title: string }") */
  slot_props?: string;
  /** Description extracted from JSDoc `@slot` or `@snippet` tags */
  description?: string;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /**
   * JSDoc tags that appeared after the prose description and before `@slot` / `@snippet`
   * (e.g. `@example`), in source order.
   */
  tags?: JsDocPassthroughTag[];
  /** Source range for the slot/snippet declaration or documentation tag, when available */
  source?: SourceRange;
}

/**
 * Slot prop value definition.
 *
 * Used internally to track slot prop types and whether they should be
 * replaced with prop type references.
 */
export interface SlotPropValue {
  /** The prop type value or reference */
  value?: string;
  /** Whether this value should be replaced with a prop type reference */
  replace: boolean;
}

export type SlotProps = Record<string, SlotPropValue>;

/**
 * Internal representation of {@link ComponentSlot} used while parsing.
 *
 * `slot_props` is either raw TS type text (from a JSDoc `@slot`/`@snippet` tag,
 * used as-is) or a structured {@link SlotProps} map (from template parsing,
 * formatted into TS type text once at the end of the parse). Keeping it
 * structured until then avoids a JSON.stringify/JSON.parse round-trip per slot.
 */
export type InternalComponentSlot = Omit<ComponentSlot, "slot_props"> & {
  slot_props?: string | SlotProps;
};

/**
 * Event that is forwarded from a child component or element.
 *
 * Forwarded events are those that use `on:eventname` syntax without
 * a handler, passing the event through to the parent.
 */
export interface ForwardedEvent {
  /** Always "forwarded" for forwarded events */
  type: "forwarded";
  /** The event name (e.g., "click", "change") */
  name: string;
  /** The element or component that forwards this event */
  element: ComponentInlineElement | ComponentElement;
  /** Description extracted from JSDoc `@event` tags */
  description?: string;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** The detail type if explicitly specified in `@event` tag */
  detail?: string;
  /** Structured `@since` / `@example` tags, in source order. */
  tags?: JsDocPassthroughTag[];
  /** Source range for the forwarded event declaration or documentation tag, when available */
  source?: SourceRange;
}

/**
 * Event that is dispatched by the component.
 *
 * Dispatched events are those created with `createEventDispatcher()` and
 * dispatched via `dispatch("eventname", detail)`, or dispatched from a custom
 * element via `$host().dispatchEvent(new CustomEvent("eventname", { detail }))`.
 */
export interface DispatchedEvent {
  /** Always "dispatched" for dispatched events */
  type: "dispatched";
  /** The event name (e.g., "click", "change") */
  name: string;
  /** The detail type (e.g., "{ value: string }", "null", "CustomEvent<...>") */
  detail?: string;
  /** Description extracted from JSDoc `@event` tags */
  description?: string;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** Structured `@since` / `@example` tags, in source order. */
  tags?: JsDocPassthroughTag[];
  /** Source range for the dispatched event call or documentation tag, when available */
  source?: SourceRange;
}

export type ComponentEvent = ForwardedEvent | DispatchedEvent;

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
export interface SerializedForwardedEvent {
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
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** The detail type if explicitly specified in `@event` tag */
  detail?: string;
  /** Structured `@since` / `@example` tags, in source order. */
  tags?: JsDocPassthroughTag[];
  /** Source range for the forwarded event declaration or documentation tag, when available */
  source?: SourceRange;
}

export type SerializedComponentEvent = SerializedForwardedEvent | DispatchedEvent;

/**
 * Type definition extracted from JSDoc `@typedef` tags.
 *
 * Represents custom types defined in component comments that can be
 * referenced by props, events, and other type annotations.
 */
export interface TypeDef {
  /** The type string representation (e.g., "{ x: number; y: number }") */
  type: string;
  /** The type name (e.g., "Point", "User") */
  name: string;
  /** Description extracted from JSDoc comments */
  description?: string;
  /** The full TypeScript type definition string (e.g., "type Point = { x: number; y: number }") */
  ts: string;
}

export type ComponentGenerics = [name: string, type: string] | null;

/**
 * Represents an inline Svelte component element.
 *
 * Used to identify which component forwards an event or accepts rest props.
 */
export interface ComponentInlineElement {
  /** Always "InlineComponent" for component elements */
  type: "InlineComponent";
  /** The component name (e.g., "Button", "Modal") */
  name: string;
}

export interface ComponentElement {
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

export type RestProps = undefined | ComponentInlineElement | ComponentElement;

/**
 * Interface extension information from JSDoc `@extends` tag.
 *
 * Allows components to extend external TypeScript interfaces for
 * better type safety and code reuse.
 */
export interface Extends {
  /** The interface name to extend (e.g., "ButtonProps") */
  interface: string;
  /** The import path for the interface (e.g., "./types" or "carbon-components-svelte") */
  import: string;
}

export interface ComponentPropBindings {
  elements: string[];
}

/**
 * Property definition for a component context.
 *
 * Represents a single property in a context object created with `setContext`.
 */
export interface ComponentContextProp {
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
export interface ComponentContext {
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
  /** Source range for the component source that was parsed */
  source?: SourceRange;
  /** Whether the component uses legacy or runes syntax according to compiler metadata */
  syntaxMode: SyntaxMode;
  /** Language used by the instance or module script when it can be determined */
  scriptLanguage?: ScriptLanguage;
  /** Component props that can be passed to the component */
  props: ComponentProp[];
  /** Exports from `<script context="module">` block */
  moduleExports: ComponentProp[];
  /** Slots available in the component template */
  slots: ComponentSlot[];
  /** Events that the component can dispatch or forward (serialized for JSON/API output) */
  events: SerializedComponentEvent[];
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
  /** Source range for the `@component` HTML comment, when available */
  componentCommentSource?: SourceRange;
  /** Contexts created with `setContext` in the component */
  contexts?: ComponentContext[];
  /** Custom-element tag name from `<svelte:options customElement="x-foo" />` (or the object form's `tag`), when present */
  customElementTag?: string;
  /**
   * Type guesses from this parse (unknown props, `any` contexts, orphan `@event` tags).
   * Set on every {@link ComponentParser.parseSvelteComponent} call.
   */
  diagnostics?: SveldDiagnostic[];
  /** Internal writer-only TypeScript metadata. Not serialized to JSON. */
  [PARSED_COMPONENT_TYPE_SCRIPT_METADATA]?: ParsedComponentTypeScriptMetadata;
}

export default class ComponentParser {
  /**
   * All per-parse mutable state (props, slots, events, scopes, source, etc.).
   * See {@link ParserContext} for field-by-field documentation. Replaced
   * wholesale by `cleanup()` between parses.
   */
  private ctx: ParserContext = createParserContext();

  private static mapToArray<T>(map: Map<string, T> | Map<string | null, T>) {
    return Array.from(map, ([_key, value]) => value);
  }

  private static getStaticAttributeValue(attribute: ModernScriptAttribute) {
    if (!Array.isArray(attribute.value)) return undefined;

    return attribute.value
      .map((value) => value.data ?? value.raw ?? "")
      .join("")
      .trim();
  }

  resolveScriptLanguage(parsed: {
    instance?: ModernScriptNode;
    module?: ModernScriptNode;
  }): ScriptLanguage | undefined {
    const scripts = [parsed.instance, parsed.module].filter(
      (script): script is ModernScriptNode => script !== undefined,
    );
    let hasPlainScript = false;

    for (const script of scripts) {
      const langAttribute = script.attributes?.find((attribute) => attribute.name === "lang");
      if (!langAttribute) {
        hasPlainScript = true;
        continue;
      }

      const language = ComponentParser.getStaticAttributeValue(langAttribute)?.toLowerCase();
      if (language === "ts") {
        return "ts";
      }
    }

    return hasPlainScript ? "js" : undefined;
  }

  /**
   * Reads the `generics` attribute off the instance script (Svelte only allows
   * it there, and only alongside `lang="ts"`). Returns the raw value for later
   * precedence resolution against `@generics`/`@template` JSDoc tags, or
   * `undefined` if absent. Records a `syntax-skipped` diagnostic and returns
   * `undefined` if the attribute is present without `lang="ts"`, since sveld
   * can't safely guess how to parse it as plain JavaScript.
   */
  resolveScriptGenericsAttribute(parsed: {
    instance?: ModernScriptNode;
  }): { value: string; source?: SourceRange } | undefined {
    const genericsAttribute = parsed.instance?.attributes?.find((attribute) => attribute.name === "generics");
    if (!genericsAttribute) return undefined;

    const source = sourceRangeFromNode(this.ctx, genericsAttribute);
    const langAttribute = parsed.instance?.attributes?.find((attribute) => attribute.name === "lang");
    const language = langAttribute ? ComponentParser.getStaticAttributeValue(langAttribute)?.toLowerCase() : undefined;

    if (language !== "ts") {
      recordDiagnostic(
        this.ctx,
        "syntax-skipped",
        "generics",
        `<script generics="..."> requires lang="ts"; the generics attribute was ignored because the script is not TypeScript.`,
        source,
      );
      return undefined;
    }

    const value = ComponentParser.getStaticAttributeValue(genericsAttribute);
    if (!value) return undefined;

    return { value, source };
  }

  private static assignValue(value?: "" | string) {
    return assignValue(value);
  }

  private resolvePublicPropName(name: string) {
    return this.ctx.propLocalToPublicName.get(name) ?? name;
  }

  trackPropLocalName(propName: string, localName = propName) {
    this.ctx.propLocalToPublicName.set(localName, propName);
  }

  private getPropByLocalOrPublic(name: string) {
    return this.ctx.props.get(this.resolvePublicPropName(name));
  }

  getPropTypeByLocalOrPublic(name: string) {
    return this.getPropByLocalOrPublic(name)?.type;
  }

  getExplicitPropType(name: string) {
    return this.ctx.explicitPropTypesByName.get(name);
  }

  getPropertyName(node: Property["key"]): string | undefined {
    if (!node || typeof node !== "object" || !("type" in node)) return undefined;

    if (isIdentifier(node)) {
      return node.name;
    }

    if (isLiteral(node)) {
      return node.value == null ? undefined : String(node.value);
    }

    return undefined;
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
  isNumericConstant(memberExpr: unknown): boolean {
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

  resolveTypeSource({
    hasTypeScriptType,
    hasJSDocType,
    inferredType,
    finalType,
  }: {
    hasTypeScriptType?: boolean;
    hasJSDocType?: boolean;
    inferredType?: string;
    finalType?: string;
  }): ComponentPropTypeSource {
    if (hasTypeScriptType) return "typescript";
    if (hasJSDocType) return "jsdoc";
    if (inferredType !== undefined) return "default";
    if (finalType !== undefined) return "inferred";
    return "unknown";
  }

  /**
   * Look up JSDoc on a local variable declaration by name.
   */
  resolveLocalVarJSDoc(name: string) {
    for (const decl of this.ctx.vars) {
      const matches = decl.declarations.some(
        (declarator) =>
          declarator.id &&
          typeof declarator.id === "object" &&
          "type" in declarator.id &&
          declarator.id.type === "Identifier" &&
          "name" in declarator.id &&
          declarator.id.name === name,
      );
      if (matches) {
        return processNodeJSDoc(this.ctx, this, decl as unknown as { leadingComments?: unknown[]; start?: number });
      }
    }

    const funcDecl = this.ctx.funcDecls.get(name);
    if (funcDecl) {
      return processNodeJSDoc(this.ctx, this, funcDecl as unknown as { leadingComments?: unknown[]; start?: number });
    }

    return undefined;
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

    if (this.ctx.moduleExports.has(prop_name)) {
      const existing_slot = this.ctx.moduleExports.get(prop_name);

      this.ctx.moduleExports.set(prop_name, {
        ...existing_slot,
        ...data,
      });
    } else {
      this.ctx.moduleExports.set(prop_name, data);
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
  aliasType(type: string): string {
    if (type === "*") return "any";
    return type.trim();
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
    if (!this.ctx.source) return;

    if (!this.ctx.sourceLinesCache) {
      this.ctx.sourceLinesCache = this.ctx.source.split("\n");
    }
    const lines = this.ctx.sourceLinesCache;

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
            const { type: typeTag, description } = getCommentTags(parsed);
            if (typeTag) {
              this.ctx.variableInfoCache.set(varName, {
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
  findVariableTypeAndDescription(varName: string): { type: string; description?: string } | null {
    const prop = this.getPropByLocalOrPublic(varName);
    if (prop?.type) {
      return {
        type: prop.type,
        description: prop.description,
      };
    }

    if (!this.ctx.variableInfoCacheBuilt) {
      this.buildVariableInfoCache();
      this.ctx.variableInfoCacheBuilt = true;
    }

    const cached = this.ctx.variableInfoCache.get(varName);
    if (cached) {
      return cached;
    }

    /**
     * Search through the source code directly for JSDoc comments.
     * This is a fallback when the variable wasn't found in the cache.
     */
    if (!this.ctx.source) return null;

    if (!this.ctx.sourceLinesCache) {
      this.ctx.sourceLinesCache = this.ctx.source.split("\n");
    }
    const lines = this.ctx.sourceLinesCache;

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
            const { type: typeTag, description } = getCommentTags(parsed);
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
  accumulateGeneric(name: string, constraint: string): void {
    if (this.ctx.generics) {
      this.ctx.generics = [`${this.ctx.generics[0]}, ${name}`, `${this.ctx.generics[1]}, ${constraint}`];
    } else {
      this.ctx.generics = [name, constraint];
    }
  }

  public cleanup() {
    this.ctx = createParserContext();
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
    this.cleanup();
    this.ctx.componentFilePath = diagnostics.filePath;
    /**
     * Strip TypeScript directives from script blocks only to prevent interference with JSDoc.
     * TypeScript directive comments can break JSDoc parsing if not removed.
     */
    const cleanedSource = ComponentParser.stripTypeScriptDirectivesFromScripts(source);
    this.ctx.source = cleanedSource;
    buildRunesPropTypeMetadata(this, this.ctx);

    /**
     * Parse once - compile() internally calls parse(), so we can extract the AST from it.
     * This avoids parsing the source twice for better performance.
     */
    const compiled = compile(cleanedSource, {
      generate: false,
      modernAst: false,
    });
    this.ctx.compiled = compiled;
    this.ctx.syntaxMode = compiled.metadata.runes ? "runes" : "legacy";

    /**
     * Reuse the AST from compilation instead of parsing again.
     * The compile result includes the parsed AST, so we use that if available,
     * otherwise fall back to parsing directly.
     */
    this.ctx.parsed =
      (compiled.ast as LegacyAstRoot | undefined) || (parse(cleanedSource, { modern: false }) as LegacyAstRoot);

    parseCustomTypes(this.ctx, this);

    /**
     * Not fused with the componentRoot walk below: `module` (`<script context="module">`) is a
     * disjoint AST rooted separately from `instance`/`html`, not a subtree reachable from either,
     * so there is no shared root to traverse once. Wrapping both in one synthetic root would
     * require branch-tracking to keep module-export handling (addModuleExport) from firing on
     * instance-level exports (addProp) and vice versa, for a pass that most components skip
     * entirely (module scripts are rare) - not worth the added complexity here.
     */
    if (this.ctx.parsed?.module) {
      walk(this.ctx.parsed?.module as unknown as Node, {
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
            let explicitType: string | undefined;
            let isFunction = false;
            let params: ComponentPropParam[] | undefined;
            let returnType: string | undefined;
            let defaultValue: ComponentPropDefaultValue | undefined;
            let inferredType: string | undefined;
            let resolvedJSDoc:
              | Pick<
                  ProcessedInitializer,
                  "resolvedType" | "resolvedDescription" | "resolvedParams" | "resolvedReturnType"
                >
              | undefined;

            if (node.declaration.type === "FunctionDeclaration") {
              const funcDecl = node.declaration as { id?: { name?: string } };
              if (!funcDecl.id?.name) return;
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

              const localPropName = (id as Identifier).name;
              prop_name = localPropName;
              kind = variableDeclarationKindToComponentPropKind(varDecl.kind);
              const initResult = init == null ? { isFunction: false } : processInitializer(this, this.ctx, init);
              ({ value, type: inferredType, isFunction, defaultValue } = initResult);
              resolvedJSDoc = initResult;
              explicitType = this.getExplicitPropType(localPropName);
              type = explicitType ?? inferredType;
            } else {
              return;
            }

            const jsdocInfo = processNodeJSDoc(this.ctx, this, node);
            if (jsdocInfo) {
              if (jsdocInfo.type && explicitType === undefined) type = jsdocInfo.type;
              params = jsdocInfo.params;
              returnType = jsdocInfo.returnType;
              if (jsdocInfo.description) description = jsdocInfo.description;
            }

            if (explicitType === undefined && jsdocInfo?.type === undefined && resolvedJSDoc?.resolvedType) {
              type = resolvedJSDoc.resolvedType;
            }
            if (description === undefined && resolvedJSDoc?.resolvedDescription) {
              description = resolvedJSDoc.resolvedDescription;
            }
            if (params === undefined && resolvedJSDoc?.resolvedParams) params = resolvedJSDoc.resolvedParams;
            if (returnType === undefined && resolvedJSDoc?.resolvedReturnType)
              returnType = resolvedJSDoc.resolvedReturnType;

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

            if (!description && type && this.ctx.typedefs.has(type)) {
              description = this.ctx.typedefs.get(type)?.description;
            }

            const typeSource = this.resolveTypeSource({
              hasTypeScriptType: explicitType !== undefined,
              hasJSDocType:
                jsdocInfo?.type !== undefined ||
                jsdocInfo?.params !== undefined ||
                jsdocInfo?.returnType !== undefined ||
                resolvedJSDoc?.resolvedType !== undefined,
              inferredType,
              finalType: type,
            });

            this.addModuleExport(prop_name, {
              name: prop_name,
              kind,
              description,
              deprecated: jsdocInfo?.deprecated,
              tags: jsdocInfo?.tags,
              type,
              typeSource,
              value,
              defaultValue,
              params,
              returnType,
              isFunction,
              isFunctionDeclaration,
              isRequired: false,
              constant: kind === "const",
              reactive: false,
              source: sourceRangeFromNode(this.ctx, node),
            });
          }
        },
      });
    }

    let dispatcher_name: undefined | string;
    const hostLocalNames = new Set<string>();
    const hostDispatchedEventNames = new Set<string>();
    const callees: { name: string; arguments: Array<Expression | unknown>; source?: SourceRange }[] = [];
    const componentRoot = {
      type: "ComponentRoot",
      instance: this.ctx.parsed.instance,
      html: this.ctx.parsed.html,
    } as unknown as Node;

    initComponentScope(this, this.ctx);
    this.ctx.activeScopes.push(this.ctx.componentScope);
    const scopeWalkState = createScopeWalkState(this.ctx);

    walk(componentRoot, {
      enter: (node, parent, _prop) => {
        /**
         * Declares nested scope bindings for `node` (if it's a scope owner) before anything
         * below reads `ctx.scopeDeclarations` for it. This fuses what was previously a separate
         * full walk (scope analysis) into this traversal: a node's own scope only ever depends
         * on its ancestors and itself, never on siblings or descendants, so building it here
         * on entry and consuming it immediately after is equivalent to building the whole map
         * in a prior pass.
         */
        enterNestedScopeDeclarationNode(this, this.ctx, scopeWalkState, node);

        const nodeScope = this.ctx.scopeDeclarations.get(node as unknown as object);
        if (nodeScope) {
          this.ctx.activeScopes.push(nodeScope);
        }

        if (node.type === "AssignmentExpression") {
          markReactivePropsFromMutationTarget(this.ctx, (node as AssignmentExpression).left);
        }

        if (node.type === "UpdateExpression") {
          markReactivePropsFromMutationTarget(this.ctx, (node as UpdateExpression).argument);
        }

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

          if (calleeName === "$host") {
            if (
              parent &&
              typeof parent === "object" &&
              "id" in parent &&
              parent.id &&
              typeof parent.id === "object" &&
              "name" in parent.id
            ) {
              hostLocalNames.add((parent.id as Identifier).name);
            }
          }

          if (calleeName === "setContext") {
            parseSetContextCall(this.ctx, this, node, parent ?? undefined);
          }

          if (calleeName) {
            callees.push({
              name: calleeName,
              arguments: callExpr.arguments,
              source: sourceRangeFromNode(this.ctx, callExpr),
            });
          }

          if (
            isMemberExpression(callExpr.callee) &&
            isIdentifier(callExpr.callee.property) &&
            callExpr.callee.property.name === "dispatchEvent" &&
            (isCallExpressionNamed(callExpr.callee.object, "$host") ||
              (isIdentifier(callExpr.callee.object) && hostLocalNames.has(callExpr.callee.object.name)))
          ) {
            const hostDispatchedEventName = parseHostDispatchEventCall(this.ctx, callExpr);
            if (hostDispatchedEventName) {
              hostDispatchedEventNames.add(hostDispatchedEventName);
            }
          }
        }

        /**
         * Check for Spread node (Svelte-specific AST node type).
         * Note: Spread is a Svelte-specific type not in estree, so we check the string value.
         * This handles `{...$$restProps}` spread syntax in component templates.
         */
        if (node && typeof node === "object" && "type" in node && String(node.type) === "Spread") {
          const spreadNode = node as { type: string; expression?: { name?: string } };
          if (
            spreadNode.expression?.name === "$$restProps" ||
            this.ctx.restPropLocals.has(spreadNode.expression?.name ?? "")
          ) {
            maybeSetRestProps(this.ctx, parent);
          }
        }

        if (node.type === "FunctionDeclaration") {
          const funcDecl = node as unknown as FunctionDeclaration;
          if (funcDecl.id?.name) {
            this.ctx.funcDecls.set(funcDecl.id.name, funcDecl);
          }
        }

        if (node.type === "VariableDeclaration") {
          this.ctx.vars.add(node as unknown as VariableDeclaration);
          if (
            parent &&
            typeof parent === "object" &&
            "type" in parent &&
            parent.type === "Program" &&
            (node as VariableDeclaration).declarations.some((declarator) =>
              isCallExpressionNamed(unwrapTypeCastExpression(declarator.init), "$props"),
            )
          ) {
            parseRunesPropsDeclaration(this, this.ctx, node as VariableDeclaration);
          }
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
            for (const varDecl of Array.from(this.ctx.vars)) {
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
          let explicitType: string | undefined;
          let isFunction = false;
          let params: ComponentPropParam[] | undefined;
          let returnType: string | undefined;
          let isRequired = false;
          let localName: string | undefined;
          let defaultValue: ComponentPropDefaultValue | undefined;
          let inferredType: string | undefined;
          let resolvedJSDoc:
            | Pick<
                ProcessedInitializer,
                "resolvedType" | "resolvedDescription" | "resolvedParams" | "resolvedReturnType"
              >
            | undefined;

          if (node.declaration.type === "FunctionDeclaration") {
            const funcDecl = node.declaration as { id?: { name?: string } };
            if (!funcDecl.id?.name) return;
            prop_name ??= funcDecl.id.name;
            localName = funcDecl.id.name;
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
              const localPropName = (id as Identifier).name;
              localName = localPropName;
              prop_name ??= localPropName;
              explicitType = this.getExplicitPropType(localPropName);
            } else {
              return;
            }

            kind = variableDeclarationKindToComponentPropKind(varDecl.kind);
            isRequired = kind === "let" && init == null;
            const initResult = init == null ? { isFunction: false } : processInitializer(this, this.ctx, init);
            ({ value, type: inferredType, isFunction, defaultValue } = initResult);
            resolvedJSDoc = initResult;
            type = explicitType ?? inferredType;
          } else {
            return;
          }

          const jsdocInfo = processNodeJSDoc(this.ctx, this, node);
          if (jsdocInfo) {
            if (jsdocInfo.type && explicitType === undefined) type = jsdocInfo.type;
            params = jsdocInfo.params;
            returnType = jsdocInfo.returnType;
            if (jsdocInfo.description) description = jsdocInfo.description;
          }

          if (explicitType === undefined && jsdocInfo?.type === undefined && resolvedJSDoc?.resolvedType) {
            type = resolvedJSDoc.resolvedType;
          }
          if (description === undefined && resolvedJSDoc?.resolvedDescription) {
            description = resolvedJSDoc.resolvedDescription;
          }
          if (params === undefined && resolvedJSDoc?.resolvedParams) params = resolvedJSDoc.resolvedParams;
          if (returnType === undefined && resolvedJSDoc?.resolvedReturnType)
            returnType = resolvedJSDoc.resolvedReturnType;

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

          if (!description && type && this.ctx.typedefs.has(type)) {
            description = this.ctx.typedefs.get(type)?.description;
          }

          const typeSource = this.resolveTypeSource({
            hasTypeScriptType: explicitType !== undefined,
            hasJSDocType:
              jsdocInfo?.type !== undefined ||
              jsdocInfo?.params !== undefined ||
              jsdocInfo?.returnType !== undefined ||
              resolvedJSDoc?.resolvedType !== undefined,
            inferredType,
            finalType: type,
          });

          addProp(this, this.ctx, prop_name, {
            name: prop_name,
            ...(localName !== undefined && localName !== prop_name ? { localName } : {}),
            kind,
            description,
            binding: jsdocInfo?.binding,
            deprecated: jsdocInfo?.deprecated,
            tags: jsdocInfo?.tags,
            type,
            typeSource,
            value,
            defaultValue,
            params,
            returnType,
            isFunction,
            isFunctionDeclaration,
            isRequired,
            constant: kind === "const",
            reactive: this.ctx.reactive_vars.has(prop_name),
            source: sourceRangeFromNode(this.ctx, node),
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
            this.ctx.componentComment = data.replace(COMPONENT_COMMENT_REGEX, "").replace(CARRIAGE_RETURN_REGEX, "");
            this.ctx.componentCommentSource = sourceRangeFromNode(this.ctx, node);
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
                  slot_prop_value.value = JSON.stringify(raw);
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
                    const literalValue = (expression as Literal).value;
                    slot_prop_value.value =
                      typeof literalValue === "string" ? JSON.stringify(literalValue) : String(literalValue);
                  } else if (expression.type === "MemberExpression") {
                    slot_prop_value.value = resolveMemberExpressionType(this.ctx, this, expression);
                  } else if (expression.type !== "Identifier") {
                    if (start !== undefined && end !== undefined) {
                      if (expression.type === "ObjectExpression" || expression.type === "TemplateLiteral") {
                        slot_prop_value.value = sourceAtPos(this.ctx, start + 1, end - 1);
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
            ?.map(({ start, end }) => {
              if (start === undefined || end === undefined) return "";
              return sourceAtPos(this.ctx, start, end) ?? "";
            })
            .join("")
            .trim();

          addSlot(this.ctx, {
            slot_name,
            slot_props,
            slot_fallback: fallback,
            source: sourceRangeFromNode(this.ctx, node),
          });
        }

        if (node && typeof node === "object" && "type" in node && String(node.type) === "RenderTag") {
          const renderTag = node as { expression?: unknown };
          const renderInfo = extractRenderTagInfo(this.ctx, renderTag.expression);
          if (renderInfo) {
            let slot_props: SlotProps | undefined;
            if (renderInfo.arguments.length === 0) {
              slot_props = {};
            } else if (
              renderInfo.arguments.length === 1 &&
              typeof renderInfo.arguments[0] === "object" &&
              renderInfo.arguments[0] &&
              "type" in renderInfo.arguments[0] &&
              renderInfo.arguments[0].type === "ObjectExpression"
            ) {
              slot_props = buildSlotPropsFromObjectExpression(
                this.ctx,
                this,
                renderInfo.arguments[0] as ObjectExpression,
              );
            } else if (renderInfo.arguments.length === 1) {
              /**
               * Multiple positional arguments (e.g. `{@render row(item, index)}`) are a
               * supported pattern typed via `Snippet<[...]>` and intentionally left unmodeled
               * here; only a single non-object argument loses information sveld can't recover.
               */
              recordDiagnostic(
                this.ctx,
                "syntax-skipped",
                renderInfo.publicName,
                `{@render ${renderInfo.publicName}(...)} argument is not a plain object literal; the render call was not mapped to slot metadata.`,
                sourceRangeFromNode(this.ctx, node),
              );
            }

            const slot_name = renderInfo.publicName === "children" ? undefined : renderInfo.publicName;
            const slotKey: string | null = slot_name === undefined ? DEFAULT_SLOT_NAME : slot_name;

            if (slot_props !== undefined) {
              addSlot(this.ctx, {
                slot_name,
                slot_props,
                source: sourceRangeFromNode(this.ctx, node),
              });
            }

            if (slot_props !== undefined || this.ctx.slots.has(slotKey)) {
              this.ctx.snippetPropLocals.add(renderInfo.trackingName);
            }
          }
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
                this.ctx.forwardedEvents.set(eventHandlerNode.name, element);

                const existing_event = this.ctx.events.get(eventHandlerNode.name);

                /**
                 * Check if this event has a JSDoc description from `@event` tags.
                 */
                const event_description = this.ctx.eventDescriptions.get(eventHandlerNode.name);
                const event_deprecated = existing_event?.deprecated;

                if (!existing_event) {
                  /**
                   * Add new forwarded event to the events map.
                   */
                  this.ctx.events.set(eventHandlerNode.name, {
                    type: "forwarded",
                    name: eventHandlerNode.name,
                    element: element,
                    description: event_description,
                    deprecated: event_deprecated,
                    source: sourceRangeFromNode(this.ctx, node),
                  });
                } else if (existing_event.type === "forwarded" && event_description && !existing_event.description) {
                  /**
                   * Event is already forwarded, just add the description if it wasn't set before.
                   */
                  this.ctx.events.set(eventHandlerNode.name, {
                    ...existing_event,
                    description: event_description,
                    deprecated: existing_event.deprecated ?? event_deprecated,
                    source: existing_event.source || sourceRangeFromNode(this.ctx, node),
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
         * Any prop used in a legacy `bind:*` expression should be treated as reactive.
         * `bind:this` on HTML elements additionally changes the prop type to include
         * the bound element type.
         */
        if (
          parent &&
          typeof parent === "object" &&
          "type" in parent &&
          (String(parent.type) === "Element" || String(parent.type) === "InlineComponent") &&
          node &&
          typeof node === "object" &&
          "type" in node &&
          String(node.type) === "Binding"
        ) {
          const bindingNode = node as { name?: string; expression?: { name?: string } };
          if (bindingNode.expression?.name) {
            const prop_name = resolveIdentifierToReactiveProp(this.ctx, bindingNode.expression.name);
            if (prop_name) {
              this.ctx.reactive_vars.add(prop_name);
            }
          }

          if (
            String(parent.type) === "Element" &&
            bindingNode.name === "this" &&
            bindingNode.expression?.name &&
            "name" in parent &&
            typeof parent.name === "string"
          ) {
            const prop_name = resolveIdentifierToReactiveProp(this.ctx, bindingNode.expression.name);
            if (!prop_name) {
              return;
            }
            const element_name = parent.name;

            if (this.ctx.bindings.has(prop_name)) {
              const existing_bindings = this.ctx.bindings.get(prop_name);

              if (existing_bindings && !existing_bindings.elements.includes(element_name)) {
                this.ctx.bindings.set(prop_name, {
                  ...existing_bindings,
                  elements: [...existing_bindings.elements, element_name],
                });
              }
            } else {
              this.ctx.bindings.set(prop_name, {
                elements: [element_name],
              });
            }
          }
        }
      },
      leave: (node) => {
        if (this.ctx.scopeDeclarations.has(node as unknown as object)) {
          this.ctx.activeScopes.pop();
        }
        leaveNestedScopeDeclarationNode(scopeWalkState, node);
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
            addDispatchedEvent(this.ctx, {
              name: String(event_name),
              detail: event_detail == null ? "" : literalDetailToTypeText(event_detail),
              has_argument: Boolean(event_argument),
              source: callee.source,
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
    const actuallyDispatchedEvents = new Set<string>(hostDispatchedEventNames);
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

    this.ctx.forwardedEvents.forEach((element, eventName) => {
      const event = this.ctx.events.get(eventName);
      /**
       * If event is marked as dispatched but is NOT actually dispatched, convert it to forwarded.
       * This happens when @event JSDoc is used but the event is actually forwarded via on: syntax.
       */
      if (event && event.type === "dispatched" && !actuallyDispatchedEvents.has(eventName)) {
        const event_description = this.ctx.eventDescriptions.get(eventName);
        const forwardedEvent: ForwardedEvent = {
          type: "forwarded",
          name: eventName,
          element: element,
          description: event_description,
          deprecated: event.deprecated,
          tags: event.tags,
          source: event.source,
        };
        /**
         * Preserve detail type if it was explicitly set in `@event` tag.
         * Note: "null" is a valid explicit type (e.g., `@event {null} eventname`).
         * Only skip if detail is truly undefined or the string "undefined".
         */
        if (event.detail !== undefined && event.detail !== "undefined") {
          forwardedEvent.detail = event.detail;
        }
        this.ctx.events.set(eventName, forwardedEvent);
      }
    });

    normalizeRunesCallbackProps(this.ctx, actuallyDispatchedEvents);

    const snippetPropNames =
      this.ctx.syntaxMode === "runes"
        ? new Set(Array.from(this.ctx.snippetPropLocals, (localName) => this.resolvePublicPropName(localName)))
        : new Set<string>();

    const processedProps = ComponentParser.mapToArray(this.ctx.props)
      .filter((prop) => !snippetPropNames.has(prop.name))
      .map((prop) => {
        if (this.ctx.bindings.has(prop.name)) {
          const elementTypes = this.ctx.bindings
            .get(prop.name)
            ?.elements.sort()
            .map((element) => getElementByTag(element))
            .join(" | ");
          return {
            ...prop,
            type: `null | ${elementTypes}`,
            typeSource: "inferred" as const,
            reactive: prop.reactive || this.ctx.reactive_vars.has(prop.name),
          };
        }

        return {
          ...prop,
          reactive: prop.reactive || this.ctx.reactive_vars.has(prop.name),
        };
      });

    this.ctx.activeScopes.length = 0;

    const processedSlots = ComponentParser.mapToArray(this.ctx.slots)
      .map((slot) => {
        // A `string` here is already-formatted TS type text from a JSDoc
        // `@slot`/`@snippet` tag; only a structured `SlotProps` map (from
        // template parsing) needs formatting into TS type text. An empty
        // object literal is normalized the same way an empty structured
        // map is, below.
        if (!slot.slot_props) {
          return slot as ComponentSlot;
        }
        if (typeof slot.slot_props === "string") {
          return EMPTY_OBJECT_TYPE_REGEX.test(slot.slot_props)
            ? { ...slot, slot_props: "Record<string, never>" }
            : (slot as ComponentSlot);
        }

        const slot_props = slot.slot_props;
        const new_props: string[] = [];

        for (const key of Object.keys(slot_props)) {
          if (slot_props[key].replace && slot_props[key].value !== undefined) {
            slot_props[key].value = this.getPropTypeByLocalOrPublic(slot_props[key].value);
          }

          if (slot_props[key].value === undefined) slot_props[key].value = "any";
          new_props.push(`${key}: ${slot_props[key].value}`);
        }

        // With more than one destructured prop, always break onto separate
        // lines (matching how an `interface` body is never collapsed)
        // rather than leave it up to whether the combined line happens to
        // fit under the formatter's width.
        const formatted_slot_props =
          new_props.length === 0
            ? "Record<string, never>"
            : new_props.length === 1
              ? `{ ${new_props[0]} }`
              : `{\n  ${new_props.join(";\n  ")};\n}`;

        return { ...slot, slot_props: formatted_slot_props };
      })
      .sort((a, b) => {
        const aName = a.name ?? "";
        const bName = b.name ?? "";
        if (aName < bName) return -1;
        if (aName > bName) return 1;
        return 0;
      });

    if (this.ctx.deferredSlotBlockGenerics.length > 0) {
      const referencedTypeText = [
        ...processedProps.map((prop) => prop.type ?? ""),
        ...processedSlots.map((slot) => slot.slot_props ?? ""),
      ].join("\n");
      for (const { name, constraint } of this.ctx.deferredSlotBlockGenerics) {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`\\b${escapedName}\\b`).test(referencedTypeText)) continue;
        this.accumulateGeneric(name, constraint);
      }
    }

    /**
     * The `generics` script attribute is the compiler-checked source of truth,
     * so it wins over any `@generics`/`@template` JSDoc tags parsed above.
     */
    if (this.ctx.scriptGenericsAttribute) {
      if (this.ctx.generics) {
        recordDiagnostic(
          this.ctx,
          "syntax-skipped",
          "generics",
          `Both the "generics" script attribute and @generics/@template JSDoc tags declare component generics; the script attribute takes precedence and the JSDoc declaration was ignored.`,
          this.ctx.scriptGenericsAttribute.source,
        );
      }
      this.ctx.generics = parseGenericsAttribute(this.ctx.scriptGenericsAttribute.value);
    }

    const moduleExportsArray = ComponentParser.mapToArray(this.ctx.moduleExports);
    /**
     * Transform events for JSON serialization: convert element object to string for backward compatibility.
     * The internal representation uses element objects, but JSON output uses strings for compatibility
     * with older versions of sveld and external tools.
     */
    const eventsArray = ComponentParser.mapToArray(this.ctx.events)
      .map((event): SerializedComponentEvent => {
        switch (event.type) {
          case "forwarded":
            return {
              ...event,
              element: event.element.name,
            };
          case "dispatched":
            return event;
          default: {
            const _exhaustive: never = event;
            return _exhaustive;
          }
        }
      })
      .sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;

        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) return typeCompare;

        if (a.type === "forwarded" && b.type === "forwarded") {
          const elementCompare = a.element.localeCompare(b.element);
          if (elementCompare !== 0) return elementCompare;
        }

        return (a.detail ?? "").localeCompare(b.detail ?? "");
      });
    const typedefsArray = ComponentParser.mapToArray(this.ctx.typedefs);
    const contextsArray = ComponentParser.mapToArray(this.ctx.contexts);

    for (const prop of processedProps) {
      if (prop.typeSource === "unknown") {
        recordDiagnostic(
          this.ctx,
          "prop-unknown-type",
          prop.name,
          `Prop "${prop.name}" type could not be inferred; falling back to "${prop.type ?? "any"}".`,
          prop.source,
        );
      }
    }

    /**
     * `@event` in JSDoc with no `createEventDispatcher`, `on:` forward,
     * or `on<event>` callback prop.
     */
    for (const eventName of this.ctx.jsDocEventNames) {
      if (actuallyDispatchedEvents.has(eventName)) continue;
      if (this.ctx.forwardedEvents.has(eventName)) continue;
      if (this.ctx.props.has(`on${eventName}`)) continue;
      recordDiagnostic(
        this.ctx,
        "event-no-source",
        eventName,
        `@event "${eventName}" has no matching dispatch or callback prop.`,
        this.ctx.jsDocEventSources.get(eventName),
      );
    }

    const parsedComponent: ParsedComponent = {
      source: sourceRangeFromOffsets(this.ctx, 0, this.ctx.source?.length),
      syntaxMode: this.ctx.syntaxMode,
      ...(this.ctx.scriptLanguage ? { scriptLanguage: this.ctx.scriptLanguage } : {}),
      props: processedProps,
      moduleExports: moduleExportsArray,
      slots: processedSlots,
      events: eventsArray,
      typedefs: typedefsArray,
      generics: this.ctx.generics,
      rest_props: this.ctx.rest_props,
      extends: this.ctx.extends,
      componentComment: this.ctx.componentComment,
      componentCommentSource: this.ctx.componentCommentSource,
      contexts: contextsArray,
      customElementTag: this.ctx.customElementTag,
      diagnostics: this.ctx.diagnosticRecords.slice(),
    };

    const typeScriptMetadata = buildTypeScriptMetadata(this.ctx);
    if (typeScriptMetadata) {
      parsedComponent[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = typeScriptMetadata;
    }

    return parsedComponent;
  }
}
