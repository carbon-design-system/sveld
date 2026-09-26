/**
 * The parsed-component model: what `ComponentParser` produces, and what the
 * cross-file pass, the writers, and the parse cache read.
 */
import type { Node, Property } from "estree";
import type { SveldDiagnostic } from "./diagnostics";
import { PARSED_COMPONENT_TYPE_SCRIPT_METADATA } from "./parsed-component-metadata";
import type { processNodeJSDoc } from "./parser/jsdoc";

/** Structured JSDoc tag (e.g. `{ name: "since", body: "1.2.0" }`). */
export interface JsDocPassthroughTag {
  name: string;
  body: string;
}

/**
 * From `@deprecated` JSDoc: a message string, or `true` when the tag has no message.
 */
export type DeprecatedValue = string | true;

/** The modern AST `Root` that `ctx.parsed` holds. */
export interface ModernAstRoot {
  module?: Node;
  fragment?: Node & { nodes?: Node[] };
  instance?: Node;
  css?: { start?: number; end?: number };
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
  /** JSDoc on the type's member (`interface Props { /** ... *\/ label: string }`). */
  jsdoc?: ReturnType<typeof processNodeJSDoc>;
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
  /** Declaration-side `<T, U = Default>` (interfaces/type aliases). */
  typeParameters?: { params?: Array<{ name?: string }> };
  /** Reference-side `<string, number>` concrete arguments (`TSTypeReference`). */
  typeArguments?: { params?: ModernRunesTypeNode[] };
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

export interface TypeImportBinding {
  importedName?: string;
  localName: string;
  source: string;
  specifierType: "default" | "named" | "namespace";
}

/** Named value import (`import { x } from "..."`) keyed for cross-file call-default lookup. */
export interface ValueImportBinding {
  localName: string;
  importedName: string;
  source: string;
}

/**
 * Prop default is a `CallExpression` whose return type we could not resolve in-parser
 * (`export let id = uniqueId()`). With `importSource`, `resolve-call-defaults.ts` (from
 * `generateBundle`) can still read the target module. Without it, keep the candidate so
 * the diagnostic can name the callee.
 */
export interface PendingCallDefaultCandidate {
  propName: string;
  location: "props" | "moduleExports";
  calleeName: string;
  importSource?: string;
  importedName?: string;
}

/**
 * Prop default is a named value import (`export let delay = DELAY_MS`), or
 * a member of a namespace import (`C.DELAY_MS`).
 * `generateBundle` reads the other file via `resolve-const-defaults.ts` and,
 * for an `export const` primitive literal, writes the literal as the default.
 */
export interface PendingConstDefaultCandidate {
  propName: string;
  location: "props" | "moduleExports";
  importSource: string;
  importedName: string;
  /** Members read off the import, through namespace exports: `["DELAY"]` for `C.timing.DELAY`. */
  members?: string[];
}

/**
 * Imported `setContext` key (`import { KEY } from "./mod.js"`, or `keys.KEY`
 * off a namespace import). `generateBundle` reads the other file via
 * `resolve-context-keys.ts`. Properties and description are already filled
 * in from the value argument.
 */
export interface PendingContextKeyCandidate {
  importSource: string;
  importedName: string;
  /** Members read off the import, through namespace exports: `["THEME"]` for `ns.keys.THEME`. */
  members?: string[];
  /** See {@link ComponentContext.type}. */
  type?: string;
  properties: ComponentContextProp[];
  description?: string;
  /** See {@link ComponentContext.hasUnresolvedSpread}. */
  hasUnresolvedSpread?: boolean;
  /** See {@link ComponentContext.internal}. */
  internal?: boolean;
  /** Source range of the `setContext(...)` call, when available. */
  source?: SourceRange;
}

/**
 * The component's dispatcher passed to an imported function
 * (`createHelper(dispatch)`). `generateBundle` reads that function via
 * `resolve-dispatch-escapes.ts` to find the events it dispatches.
 */
export interface PendingDispatchEscapeCandidate {
  importSource: string;
  importedName: string;
  /** Members read off the import, through namespace exports: `["helper"]` for `ns.helper`. */
  members?: string[];
  /** Callee as written, for messages. */
  calleeText: string;
  /** Local name of the `createEventDispatcher()` result. */
  dispatcherName: string;
  /** Argument position the dispatcher is passed at. */
  argumentIndex: number;
  /** Set when passed as an object literal property (`{ dispatch }`): that property's key. */
  property?: string;
  /** Source range of the call, when available. */
  source?: SourceRange;
  /** `@sveld-ignore sveld/dispatch-escapes` on the dispatcher's declaration. */
  ignored?: boolean;
}

export interface LocalTypeDeclaration {
  code: string;
  node: ModernRunesTypeNode;
  start: number;
  /** Exported from the module script, so the `.d.ts` exports it too. */
  exported?: boolean;
}

/**
 * What a parse leaves for a pass that can read the files a component
 * imports from: `generateBundle` resolves these (see `cross-file.ts`), and
 * `finalizeWithoutCrossFileResolution` settles them without file access.
 */
export interface PendingCrossFileCandidates {
  /** Unresolved CallExpression defaults. */
  pendingCallDefaultCandidates?: PendingCallDefaultCandidate[];
  /** Imported-identifier defaults. */
  pendingConstDefaultCandidates?: PendingConstDefaultCandidate[];
  /** Unresolved `setContext` import keys. */
  pendingContextKeyCandidates?: PendingContextKeyCandidate[];
  /** Dispatchers passed to imported functions. */
  pendingDispatchEscapeCandidates?: PendingDispatchEscapeCandidate[];
  /**
   * `event-no-source` diagnostics held back while the dispatcher escapes to
   * imported functions: the cross-file pass keeps those the functions don't dispatch.
   */
  deferredEventNoSourceDiagnostics?: SveldDiagnostic[];
  /**
   * `@event` tags with no `{type}` or `@property`, whose `null` detail no
   * same-file dispatch replaced; an escaped dispatcher's helper may still.
   */
  untypedJsDocEventNames?: string[];
}

/**
 * Writer-only metadata on a parsed component. `parseSvelteComponent` also
 * folds the {@link PendingCrossFileCandidates} in here; {@link ComponentParser.parse}
 * returns them separately instead.
 */
export interface ParsedComponentTypeScriptMetadata extends PendingCrossFileCandidates {
  canonicalPropsType?: string;
  canonicalPropNames: string[];
  localTypeDeclarations: string[];
  /** Types the module script exports (`export interface Item`), emitted with `export`. */
  moduleTypeDeclarations?: string[];
  typeImportStatements: string[];
}

/** A component parse, with what's left for the cross-file pass kept apart. */
export interface ComponentParseResult {
  component: ParsedComponent;
  /** Undefined when the component depends on no other file's contents. */
  pending?: PendingCrossFileCandidates;
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
  /**
   * CallExpression default with no in-parser return type
   * ({@link PendingCallDefaultCandidate}). Caller adds `propName`/`location`
   * onto {@link ParserContext.pendingCallDefaultCandidates}.
   */
  pendingCallDefault?: Omit<PendingCallDefaultCandidate, "propName" | "location">;
  /** Identifier default bound to a named value import ({@link PendingConstDefaultCandidate}). */
  pendingConstDefault?: Omit<PendingConstDefaultCandidate, "propName" | "location">;
}

export type ModernScriptAttribute = {
  name?: string;
  value?: Array<{ data?: string; raw?: string }> | boolean;
  start?: number;
  end?: number;
};

export type ModernScriptNode = {
  attributes?: ModernScriptAttribute[];
};

export type ComponentPropBinding = "readonly" | "writable";

/** Function prop parameter from JSDoc `@param` tags. */
export interface ComponentPropParam {
  /** Parameter name. */
  name: string;
  /** Parameter type (e.g. `"string"`, `"CustomType"`). */
  type: string;
  /** From JSDoc `@param`. */
  description?: string;
  /** True when optional. */
  optional?: boolean;
}

/** Where a `<script context="module">` re-export's binding comes from. */
export interface ComponentPropReExport {
  /** Module specifier as written in the source (e.g. `"./utils.js"`). */
  from: string;
  /** Name `from` exports: `"default"` for a default import, `"*"` for `export *` or a namespace import. */
  imported: string;
}

/**
 * One public member of a module-script class export
 * ({@link ComponentProp.members}). Private (`#x`, `private`) and
 * `protected` members, and `@internal`/`@ignore` ones, are left out.
 */
export interface ComponentClassMember {
  /** `"property"` covers fields, constructor parameter properties, and getter/setter pairs. */
  kind: "constructor" | "method" | "property";
  /** Member name; `"constructor"` for the constructor. */
  name: string;
  /** Property type text; `"any"` when neither TypeScript nor JSDoc types it. */
  type?: string;
  /** Method or constructor parameters, typed from TypeScript or JSDoc `@param`, else `"any"`. A rest parameter's name starts with `...`. */
  params?: ComponentPropParam[];
  /** Method return type from TypeScript or JSDoc `@returns`; unset when neither gives one. */
  returnType?: string;
  /** A method's own type parameter list (`U extends object`), without the angle brackets. */
  typeParameters?: string;
  static?: true;
  /** A `readonly` field, or a getter with no setter. */
  readonly?: true;
  optional?: true;
  abstract?: true;
  description?: string;
  deprecated?: DeprecatedValue;
  tags?: JsDocPassthroughTag[];
}

/**
 * A parsed component prop: the shared internal IR that every prop front-end
 * (legacy `<script context="module">` exports, legacy instance
 * `export let`/`export function`, and runes `$props()` destructuring)
 * produces via {@link resolvePropTypeAndDocs}, then hands to `addProp`. The
 * three front-ends differ only in how they extract the raw signals (type
 * text, JSDoc, initializer shape) from their respective AST shapes; the
 * decisions below are shared and, outside the two documented mode
 * differences, identical across modes.
 *
 * - `typeSource` precedence: an explicit TypeScript annotation always wins,
 *   then JSDoc (`@type`/`@param`/`@returns`), then a type resolved from an
 *   identifier default's own JSDoc, and only then a bare inferred/initializer
 *   type. See {@link resolveTypeSource}.
 * - JSDoc-vs-TS merge: `type`/`params`/`returnType`/`description` each
 *   independently prefer their JSDoc-sourced value over the identifier
 *   default's resolved value; an explicit TypeScript type additionally beats
 *   JSDoc for `type` only.
 * - Mode difference (preserved, not converged): legacy `export let`/
 *   `export function` never infers `isFunction` from a function-shaped type
 *   text; runes `$props()` does (`inferIsFunctionFromTypeSignature`).
 * - Mode difference (preserved, not converged): legacy falls back to a
 *   matching `@typedef`'s own description when the prop has none; runes does
 *   not pass `typedefs` to {@link resolvePropTypeAndDocs} today.
 */
export interface ComponentProp {
  /** Public prop name; `"*"` for a bare `export * from "..."`. */
  name: string;
  /**
   * `"let"` (required), `"const"` (default), or `"function"`. `"re-export"`
   * is module-export only: `export { x } from "..."`, `export * from "..."`,
   * or `export { x }` of an imported binding, written to the `.d.ts` as-is.
   * `"class"` is module-export only too: a class the module script declares,
   * with its public surface in {@link ComponentProp.members}.
   */
  kind: "let" | "const" | "function" | "re-export" | "class";
  /** True when declared with `const`. */
  constant: boolean;
  /** TypeScript type text. */
  type?: string;
  /** Conservative provenance for the prop type. See the precedence rule on {@link ComponentProp}. */
  typeSource?: ComponentPropTypeSource;
  /** Local binding when it differs from the public name. */
  localName?: string;
  /** Default value as source text; unset when the prop has no initializer/default. */
  value?: string;
  /** Structured default value metadata for docs UIs; set alongside `value` from the same initializer. */
  defaultValue?: ComponentPropDefaultValue;
  /** From JSDoc, or a matching `@typedef`'s own description (legacy only; see {@link ComponentProp}). */
  description?: string;
  /** From JSDoc `@param` on function props. */
  params?: ComponentPropParam[];
  /** From JSDoc `@returns` on function props. */
  returnType?: string;
  /**
   * A function's own type parameter list from its `@template` tags (e.g.
   * `T extends { id: string }`), without the angle brackets. Also prefixed
   * onto `type` when that signature is built from `@param`/`@returns`.
   * For a `"class"`, the class's type parameters, from TypeScript or `@template`.
   */
  typeParameters?: string;
  /** Set when `kind` is `"class"`: its public constructor, methods, and properties, in source order. */
  members?: ComponentClassMember[];
  /** Set when `kind` is `"class"` and the class is `abstract`. */
  abstract?: true;
  /** Set when `kind` is `"class"` and it extends a base class: `Base<T>`. */
  extends?: string;
  /** Set when `kind` is `"class"` and it implements interfaces: `["Disposable"]`. */
  implements?: string[];
  /**
   * True for arrow/function-expression initializers and bare `function`
   * declarations in every mode; additionally true for a function-shaped
   * type/JSDoc signature in runes only (see {@link ComponentProp}).
   */
  isFunction: boolean;
  /** True for `function` declarations. */
  isFunctionDeclaration: boolean;
  /** True when declared with `let` and no default. */
  isRequired: boolean;
  /**
   * True when the prop is mutated locally (legacy, inferred from assignment/
   * binding targets) or declared with `$bindable()` (runes).
   */
  reactive: boolean;
  /** Binding direction from `@bindable` JSDoc. */
  binding?: ComponentPropBinding;
  /** True when declared with Svelte 5 `$bindable()` (runes only). */
  bindable?: true;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** `@since` / `@example` tags in source order. */
  tags?: JsDocPassthroughTag[];
  /** True from `@ignore`/`@internal` JSDoc; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
  /** Set when `kind` is `"re-export"`. */
  reExport?: ComponentPropReExport;
  /** Source range when available. */
  source?: SourceRange;
}

export interface ComponentSlot {
  /** Slot name (`null` for the default slot). */
  name?: string | null;
  /** True for the default slot. */
  default: boolean;
  /** Fallback content when the slot is empty. */
  fallback?: string;
  /** Slot props as TypeScript type text. */
  slot_props?: string;
  /** From JSDoc `@slot` or `@snippet`. */
  description?: string;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** Tags between the description and `@slot`/`@snippet` (e.g. `@example`), in source order. */
  tags?: JsDocPassthroughTag[];
  /** True from `@ignore`/`@internal` JSDoc; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
  /** Source range when available. */
  source?: SourceRange;
}

/** Slot prop type text or a reference to resolve at finalize time. */
export interface SlotPropValue {
  /** Type text or reference. */
  value?: string;
  /** True to replace with a prop type reference. */
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
  /** True when a `{...spread}` in the slot's props object couldn't be resolved; folded into `slot_props` text as `& Record<string, any>` before output. */
  slot_props_unresolved_spread?: boolean;
};

/** Event forwarded with `on:eventname` and no handler. */
export interface ForwardedEvent {
  /** Discriminator: `"forwarded"`. */
  type: "forwarded";
  /** Event name. */
  name: string;
  /** Element or component that forwards the event. */
  element: ComponentInlineElement | ComponentElement;
  /** From JSDoc `@event`. */
  description?: string;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** Detail type from `@event`. */
  detail?: string;
  /** `@since` / `@example` tags in source order. */
  tags?: JsDocPassthroughTag[];
  /** True from `@ignore`/`@internal` JSDoc; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
  /** Source range when available. */
  source?: SourceRange;
}

/** Event from `createEventDispatcher()`, `dispatch()`, or `$host().dispatchEvent()`. */
export interface DispatchedEvent {
  /** Discriminator: `"dispatched"`. */
  type: "dispatched";
  /** Event name. */
  name: string;
  /** Detail type text. */
  detail?: string;
  /** From JSDoc `@event`. */
  description?: string;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** `@since` / `@example` tags in source order. */
  tags?: JsDocPassthroughTag[];
  /** True from `@ignore`/`@internal` JSDoc; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
  /** Source range when available. */
  source?: SourceRange;
}

export type ComponentEvent = ForwardedEvent | DispatchedEvent;

/**
 * Serialized {@link ForwardedEvent} for JSON output. `element` is a string, not an object.
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
  /** Discriminator: `"forwarded"`. */
  type: "forwarded";
  /** Event name. */
  name: string;
  /** Element name as a string for JSON output. */
  element: string;
  /** From JSDoc `@event`. */
  description?: string;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** Detail type from `@event`. */
  detail?: string;
  /** `@since` / `@example` tags in source order. */
  tags?: JsDocPassthroughTag[];
  /** True from `@ignore`/`@internal` JSDoc; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
  /** Source range when available. */
  source?: SourceRange;
}

export type SerializedComponentEvent = SerializedForwardedEvent | DispatchedEvent;

/** JSDoc `@typedef` extracted as a named type. */
export interface TypeDef {
  /** Type text (e.g. `"{ x: number; y: number }"`). */
  type: string;
  /** Type name. */
  name: string;
  /** From JSDoc. */
  description?: string;
  /** Full `type` alias declaration text. */
  ts: string;
  /** Tags in the same block (e.g. `@since`, `@example`, `@see`), in source order. */
  tags?: JsDocPassthroughTag[];
  /** True from `@ignore`/`@internal` JSDoc; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
  /** Source range of the `@typedef`/`@callback` tag, when available. */
  source?: SourceRange;
}

export type ComponentGenerics = [name: string, type: string] | null;

export interface ComponentInlineElement {
  /** Discriminator: `"InlineComponent"`. */
  type: "InlineComponent";
  /** Component name. */
  name: string;
}

export interface ComponentElement {
  type: "Element";
  name: string;
  /**
   * Static tag for `svelte:element this="div"`. Undefined when `this` is dynamic.
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
  /** From `@restProps` JSDoc. */
  description?: string;
}

export type RestProps = undefined | ComponentInlineElement | ComponentElement;

/** JSDoc `@extends` target. */
export interface Extends {
  /** Interface name (e.g. `"ButtonProps"`). */
  interface: string;
  /** Import path (e.g. `"./types"`). */
  import: string;
}

/** `customElement.props.<name>.type` in `<svelte:options customElement={{ ... }} />`. */
export type CustomElementPropType = "String" | "Boolean" | "Number" | "Array" | "Object";

/** `customElement.props.<name>` config in `<svelte:options customElement={{ ... }} />`. */
export interface CustomElementPropConfig {
  /** Explicit attribute name. Svelte itself always observes every prop as an attribute; sveld's own output omits the attribute entirely when this is `false`. */
  attribute?: string | false;
  reflect?: boolean;
  type?: CustomElementPropType;
}

/**
 * Parsed `<svelte:options customElement="tag" />` (shorthand, `tag` only) or
 * `<svelte:options customElement={{ tag, shadow, props, extend }} />` (object
 * form). `extend`'s callback expression isn't serializable, so only its
 * presence is recorded.
 */
export interface CustomElementOptions {
  tag?: string;
  shadow?: "open" | "none";
  props?: Record<string, CustomElementPropConfig>;
  extend?: true;
}

/** From a component-level `@csspart` JSDoc tag. */
export interface ComponentCssPart {
  name: string;
  description?: string;
}

/** From a component-level `@cssprop`/`@cssproperty` JSDoc tag. */
export interface ComponentCssProperty {
  /** Includes the leading `--`. */
  name: string;
  type?: string;
  default?: string;
  description?: string;
}

export interface ComponentPropBindings {
  elements: string[];
}

export interface ComponentContextProp {
  /** Property name. */
  name: string;
  /** Property type text. */
  type: string;
  /** From JSDoc. */
  description?: string;
  /** True when optional. */
  optional: boolean;
  /** True from `@ignore`/`@internal` JSDoc; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
}

/** Context from `setContext(key, value)`. */
export interface ComponentContext {
  /** Context key from `setContext`. */
  key: string;
  /** Generated type name (e.g. `"ModalContext"`). */
  typeName: string;
  /**
   * The context's whole type, when the `setContext` value is a variable whose
   * type isn't an object type literal (`ModalAPI`, `Writable<number>`, or `any`
   * when untyped). `properties` is empty then.
   */
  type?: string;
  /** From JSDoc. */
  description?: string;
  /** Context object properties. Empty when {@link ComponentContext.type} is set. */
  properties: ComponentContextProp[];
  /** True when a `{...spread}` in the context's object literal couldn't be resolved; the generated type intersects with `Record<string, any>`. */
  hasUnresolvedSpread?: boolean;
  /** True from `@ignore`/`@internal` JSDoc on the `setContext` call; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
  /** Source range of the `setContext(...)` call, when available. */
  source?: SourceRange;
}

/**
 * Complete parsed component metadata from {@link ComponentParser.parseSvelteComponent}.
 *
 * @example
 * ```ts
 * const parser = new ComponentParser();
 * const parsed = parser.parseSvelteComponent(source, {
 *   moduleName: "Button",
 *   filePath: "./Button.svelte"
 * });
 *
 * parsed.props;
 * parsed.slots;
 * parsed.events;
 * parsed.typedefs;
 * parsed.contexts;
 * ```
 */
export interface ParsedComponent {
  /** Source range of the parsed file. */
  source?: SourceRange;
  syntaxMode: SyntaxMode;
  scriptLanguage?: ScriptLanguage;
  /** Instance-level props (`export let`/`export function`, or runes `$props()`). See {@link ComponentProp} for the shared IR these are built from. */
  props: ComponentProp[];
  /** Exports from `<script context="module">`. Same {@link ComponentProp} shape as `props`, resolved through the same shared decisions. */
  moduleExports: ComponentProp[];
  slots: ComponentSlot[];
  /** Serialized events for JSON/API output. */
  events: SerializedComponentEvent[];
  typedefs: TypeDef[];
  generics: null | ComponentGenerics;
  rest_props: RestProps;
  extends?: Extends;
  /** From `@component` HTML comment. */
  componentComment?: string;
  componentCommentSource?: SourceRange;
  contexts?: ComponentContext[];
  customElementTag?: string;
  /** Full `<svelte:options customElement=... />` config (shorthand or object form), when present. */
  customElement?: CustomElementOptions;
  /** From component-level `@csspart` JSDoc tags. */
  cssParts?: ComponentCssPart[];
  /** From component-level `@cssprop`/`@cssproperty` JSDoc tags. */
  cssProperties?: ComponentCssProperty[];
  /**
   * Type guesses from this parse (unknown props, `any` contexts, orphan `@event` tags).
   */
  diagnostics?: SveldDiagnostic[];
  /** Writer-only TypeScript metadata. Not serialized to JSON. */
  [PARSED_COMPONENT_TYPE_SCRIPT_METADATA]?: ParsedComponentTypeScriptMetadata;
}
