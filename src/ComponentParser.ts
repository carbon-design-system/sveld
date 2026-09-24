import type {
  AssignmentExpression,
  CallExpression,
  ClassDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  Expression,
  FunctionDeclaration,
  Identifier,
  Literal,
  MemberExpression,
  Node,
  ObjectExpression,
  Property,
  UpdateExpression,
  VariableDeclaration,
  VariableDeclarator,
} from "estree";
import {
  isCallExpressionNamed,
  isIdentifier,
  isLiteral,
  isMemberExpression,
  unwrapTypeCastExpression,
} from "./ast-guards";
import type { SveldDiagnostic } from "./diagnostics";
import { getElementByTag } from "./element-tag-map";
import { PARSED_COMPONENT_TYPE_SCRIPT_METADATA } from "./parsed-component-metadata";
import { resolveMemberExpressionType } from "./parser/bindings";
import { createParserContext, type ParserContext } from "./parser/context";
import { parseSetContextCall } from "./parser/contexts";
import { buildDiagnostic, isSveldIgnored, recordDiagnostic, recordSveldIgnore } from "./parser/diagnostics";
import { isComponentLikeType, isElementLikeType } from "./parser/element-kind";
import {
  addDispatchedEvent,
  compareSerializedEvents,
  deriveLiteralDetailType,
  findDispatcherArgument,
  literalDetailToTypeText,
  parseHostDispatchEventCall,
} from "./parser/events";
import { parseGenericsAttribute } from "./parser/generics";
import { parseCustomTypes, processNodeJSDoc } from "./parser/jsdoc";
import { resolvePropTypeAndDocs } from "./parser/prop-shared";
import { addProp, processInitializer, queuePendingCrossFileDefault } from "./parser/props";
import { maybeSetRestProps } from "./parser/rest-props";
import { detectSyntaxMode } from "./parser/runes-detection";
import {
  buildRunesPropTypeMetadata,
  normalizeRunesCallbackProps,
  parseRunesPropsDeclaration,
  registerTypedDispatcherEvents,
} from "./parser/runes-props";
import {
  collectPatternIdentifiers,
  createScopeWalkState,
  enterNestedScopeDeclarationNode,
  initComponentScope,
  isScopeOwner,
  leaveNestedScopeDeclarationNode,
  markReactivePropsFromMutationTarget,
  resolveIdentifierToReactiveProp,
} from "./parser/scopes";
import { addSlot, buildSlotPropsFromObjectExpression, extractRenderTagInfo } from "./parser/slots";
import {
  sourceAtPos,
  sourceForExpression,
  sourceRangeFromNode,
  sourceRangeFromOffsets,
} from "./parser/source-position";
import {
  buildFunctionDeclarationSignature,
  buildTypeScriptMetadata,
  type FunctionDeclarationLike,
} from "./parser/type-resolution";
import { stripTypeCastWrappers } from "./parser/typescript-casts";
import { assignValueOrUndefined } from "./parser/utils";
import {
  collectHoistedScriptBindings,
  collectReExportableImports,
  collectValueImportBindings,
  type ImportDeclarationNode,
  scriptBody,
} from "./parser/value-imports";
import { buildVariableJsDocTable } from "./parser/variable-jsdoc";
import { type WalkableNode, type WalkEnter, type WalkLeave, walkNodes } from "./parser/walk";
import { parse as parseModernAst } from "./svelte-template-parse";

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
/** Name of an export/import specifier's `local`/`exported`/`imported` (an identifier or a string literal). */
function moduleExportName(node: Identifier | Literal | undefined): string | undefined {
  if (node?.type === "Identifier") return node.name;
  return typeof node?.value === "string" ? node.value : undefined;
}

/** {@link ComponentParser.resolveExportSpecifier}: `declaration`/`declarator` are unset when no local declaration matched. */
interface ResolvedExportSpecifier {
  localName: string;
  exportedName: string;
  declaration?: VariableDeclaration | FunctionDeclaration | ClassDeclaration;
  /** For a variable, the declarator whose `id` (or destructuring pattern) binds `localName`. */
  declarator?: VariableDeclarator;
  /** The top-level statement holding `declaration`, whose doc comment documents it. */
  statement?: Node;
}

/**
 * The top-level function, class, or variable declarator in `program` that binds
 * `localName`, which can come before or after the export naming it.
 */
function findTopLevelBinding(
  program: Node | null,
  localName: string,
): Pick<ResolvedExportSpecifier, "declaration" | "declarator" | "statement"> | undefined {
  for (const statement of (program && scriptBody(program)) ?? []) {
    const node = statement as Node;
    const declaration = node.type === "ExportNamedDeclaration" && node.declaration ? node.declaration : node;
    if (declaration.type === "VariableDeclaration") {
      const declarator = declaration.declarations.find((decl) =>
        decl.id.type === "Identifier" ? decl.id.name === localName : collectPatternIdentifiers(decl.id).has(localName),
      );
      if (declarator) return { declaration, declarator, statement: node };
    } else if (
      (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") &&
      declaration.id?.name === localName
    ) {
      return { declaration, statement: node };
    }
  }
  return undefined;
}

/**
 * `$: localName = value` with no other declaration of `localName` declares it,
 * so an export of it is a `let` prop initialized to `value`. Returns that
 * implied `let localName = value`.
 */
function findReactiveDeclaration(
  program: Node | null,
  localName: string,
): Pick<ResolvedExportSpecifier, "declaration" | "declarator" | "statement"> | undefined {
  for (const statement of (program && scriptBody(program)) ?? []) {
    const node = statement as Node;
    if (node.type !== "LabeledStatement" || node.label.name !== "$") continue;
    if (node.body.type !== "ExpressionStatement") continue;
    const assignment = node.body.expression;
    if (assignment.type !== "AssignmentExpression" || assignment.operator !== "=") continue;
    if (!collectPatternIdentifiers(assignment.left).has(localName)) continue;
    const declarator: VariableDeclarator = {
      type: "VariableDeclarator",
      id: assignment.left,
      init: assignment.right,
    };
    return {
      declaration: { type: "VariableDeclaration", kind: "let", declarations: [declarator] },
      declarator,
      statement: node,
    };
  }
  return undefined;
}

function variableDeclarationKindToComponentPropKind(kind: VariableDeclaration["kind"]): "let" | "const" {
  if (kind === "var") return "let";
  if (kind === "using" || kind === "await using") return "const";
  return kind;
}

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

type TemplateNode = { start?: number; end?: number };

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
 * Prop default is a named value import (`export let delay = DELAY_MS`).
 * `generateBundle` reads the other file via `resolve-const-defaults.ts` and,
 * for an `export const` primitive literal, writes the literal as the default.
 */
export interface PendingConstDefaultCandidate {
  propName: string;
  location: "props" | "moduleExports";
  importSource: string;
  importedName: string;
}

/**
 * Named-import `setContext` key (`import { KEY } from "./mod.js"`).
 * `generateBundle` reads the other file via `resolve-context-keys.ts`.
 * Properties and description are already filled in from the value argument.
 */
export interface PendingContextKeyCandidate {
  importSource: string;
  importedName: string;
  properties: ComponentContextProp[];
  description?: string;
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

export interface ParsedComponentTypeScriptMetadata {
  canonicalPropsType?: string;
  canonicalPropNames: string[];
  localTypeDeclarations: string[];
  /** Types the module script exports (`export interface Item`), emitted with `export`. */
  moduleTypeDeclarations?: string[];
  typeImportStatements: string[];
  /**
   * Whether `canonicalPropsType` mentions one of the component's own
   * `<script generics="...">` parameters (e.g. `Props<T>`). The semantic
   * resolver has no binding for `T`, so `resolveTypes` must leave this
   * component's props as their AST-derived text rather than expand them.
   */
  referencesComponentGenerics?: boolean;
  /** Unresolved CallExpression defaults for the cross-file pass in `generateBundle`. */
  pendingCallDefaultCandidates?: PendingCallDefaultCandidate[];
  /** Imported-identifier defaults for the cross-file pass in `generateBundle`. */
  pendingConstDefaultCandidates?: PendingConstDefaultCandidate[];
  /** Unresolved `setContext` import keys for the cross-file pass in `generateBundle`. */
  pendingContextKeyCandidates?: PendingContextKeyCandidate[];
  /** Dispatchers passed to imported functions, for the cross-file pass in `generateBundle`. */
  pendingDispatchEscapeCandidates?: PendingDispatchEscapeCandidate[];
  /**
   * `event-no-source` diagnostics held back while the dispatcher escapes to
   * imported functions: `generateBundle` keeps those the functions don't dispatch.
   */
  deferredEventNoSourceDiagnostics?: SveldDiagnostic[];
}

export {
  applyResolvedProps,
  getParsedComponentTypeScriptMetadata,
  PARSED_COMPONENT_TYPE_SCRIPT_METADATA,
} from "./parsed-component-metadata";

/** One prop returned by the TypeScript checker during `resolveTypes`. */
export interface ResolvedComponentProp {
  name: string;
  type: string;
  isRequired: boolean;
  description?: string;
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

type ModernScriptAttribute = {
  name?: string;
  value?: Array<{ data?: string; raw?: string }> | boolean;
  start?: number;
  end?: number;
};

export type ModernScriptNode = {
  attributes?: ModernScriptAttribute[];
};

interface ComponentParserDiagnostics {
  moduleName: string;
  filePath: string;
}

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
/** Where a `<script context="module">` re-export's binding comes from. */
export interface ComponentPropReExport {
  /** Module specifier as written in the source (e.g. `"./utils.js"`). */
  from: string;
  /** Name `from` exports: `"default"` for a default import, `"*"` for `export *` or a namespace import. */
  imported: string;
}

export interface ComponentProp {
  /** Public prop name; `"*"` for a bare `export * from "..."`. */
  name: string;
  /**
   * `"let"` (required), `"const"` (default), or `"function"`. `"re-export"`
   * is module-export only: `export { x } from "..."`, `export * from "..."`,
   * or `export { x }` of an imported binding, written to the `.d.ts` as-is.
   */
  kind: "let" | "const" | "function" | "re-export";
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
   */
  typeParameters?: string;
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

const DEFAULT_SLOT_NAME = null;

/** Matches `@component` in HTML comments. */
const COMPONENT_COMMENT_REGEX = /^@component/;

const CARRIAGE_RETURN_REGEX = /\r/g;

/** Matches a JSDoc `@slot`/`@snippet` type of an empty object literal, e.g. `{{}}` or `{{ }}`. */
const EMPTY_OBJECT_TYPE_REGEX = /^\{\s*\}$/;

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
  /** From JSDoc. */
  description?: string;
  /** Context object properties. */
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

/**
 * Node types the main `componentRoot` walk in `parseSvelteComponent` acts on.
 * Keep in sync with the `type === "..."` checks in that walk's `enter`.
 */
const MAIN_WALK_NODE_TYPES = new Set([
  "AssignmentExpression",
  "UpdateExpression",
  "CallExpression",
  "SpreadAttribute",
  "FunctionDeclaration",
  "ImportDeclaration",
  "VariableDeclaration",
  "ExportNamedDeclaration",
  "Comment",
  "SlotElement",
  "RenderTag",
  "OnDirective",
  "BindDirective",
]);

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

  private addModuleExport(prop_name: string, data: ComponentProp) {
    if (assignValueOrUndefined(prop_name) === undefined) return;

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
   * Resolves one `export { local as exported }` specifier to the top-level
   * function, class, or variable declarator (including one destructured
   * from a pattern) it names. Each specifier resolves on its own, so
   * `export { a, b }` exports both, and `const a = 1, b = ""; export { b }`
   * exports `b`'s declarator rather than the first one in the declaration.
   *
   * `program` is the script the export sits in: only its top-level
   * declarations count, not a same-named variable inside a function. An
   * instance-script export can also name a module-script declaration, or a
   * variable that a `$: local = ...` reactive declaration declares implicitly.
   */
  private resolveExportSpecifier(
    node: ExportNamedDeclaration,
    specifier: ExportSpecifier,
    program: Node | null,
    script: "instance" | "module",
  ): ResolvedExportSpecifier | undefined {
    const localName = moduleExportName(specifier.local);
    const exportedName = moduleExportName(specifier.exported);
    if (!localName || !exportedName) return undefined;
    // `export { x } from "..."` names the other module's `x`, never a local one.
    if (node.source != null) return { localName, exportedName };

    let binding = findTopLevelBinding(program, localName);
    if (!binding && script === "instance") {
      const module = this.ctx.parsed?.module as unknown as Node | undefined;
      binding = findTopLevelBinding(module ?? null, localName) ?? findReactiveDeclaration(program, localName);
    }
    return { localName, exportedName, ...binding };
  }

  private recordUnresolvedExportSpecifier(node: ExportNamedDeclaration, localName: string, exportedName: string) {
    const source = node.source?.value;
    const reason =
      typeof source === "string"
        ? `it re-exports from "${source}"`
        : this.ctx.valueImportBindingsByLocalName.has(localName)
          ? "it re-exports an imported binding"
          : "no matching local declaration was found";
    recordDiagnostic(
      this.ctx,
      "export-unresolved",
      exportedName,
      `export "${exportedName}" was skipped because ${reason}; sveld only resolves exports of a local declaration.`,
      sourceRangeFromNode(this.ctx, node),
    );
  }

  /**
   * Doc comment for a declaration exported by `node`. A specifier uses the
   * comment on the declaration it names. An `export { ... }` list's own
   * comment documents it too, but only when the list has a single specifier;
   * its tags and description then override the declaration's.
   */
  private exportJSDoc(node: ExportNamedDeclaration, specifier: ResolvedExportSpecifier | undefined) {
    if (!specifier) return processNodeJSDoc(this.ctx, this, node);
    const listJSDoc = node.specifiers.length === 1 ? processNodeJSDoc(this.ctx, this, node) : undefined;
    const declarationJSDoc = processNodeJSDoc(this.ctx, this, specifier.statement);
    if (!listJSDoc || !declarationJSDoc) return listJSDoc ?? declarationJSDoc;
    const listFields = Object.fromEntries(Object.entries(listJSDoc).filter(([, value]) => value !== undefined));
    return { ...declarationJSDoc, ...listFields, internal: listJSDoc.internal || declarationJSDoc.internal };
  }

  /** `export class Foo {}` or `export { Foo }` of a class: neither a prop nor a documented accessor. */
  private recordClassExport(node: ExportNamedDeclaration, exportedName: string) {
    recordDiagnostic(
      this.ctx,
      "export-unresolved",
      exportedName,
      `export "${exportedName}" was skipped because it's a class; sveld doesn't document exported classes.`,
      sourceRangeFromNode(this.ctx, node),
    );
  }

  /**
   * @example
   * ```ts
   * aliasType("*"); // "any"
   * aliasType(" string "); // "string"
   * ```
   */
  aliasType(type: string): string {
    if (type === "*") return "any";
    return type.trim();
  }

  /**
   * @example
   * ```ts
   * // Given:
   * // /**
   * //  * @type {number}
   * //  * The count value
   * //  *\/
   * // const count = 0;
   *
   * findVariableTypeAndDescription("count");
   * // { type: "number", description: "The count value" }
   * ```
   */
  findVariableTypeAndDescription(varName: string): { type: string; description?: string; internal?: boolean } | null {
    const prop = this.getPropByLocalOrPublic(varName);
    if (prop?.type) {
      return {
        type: prop.type,
        description: prop.description,
        internal: prop.internal,
      };
    }

    if (!this.ctx.variableInfoCacheBuilt) {
      this.ctx.variableInfoCache = buildVariableJsDocTable(this.ctx, this);
      this.ctx.variableInfoCacheBuilt = true;
    }

    const cached = this.ctx.variableInfoCache.get(varName);

    const explicitType = this.ctx.explicitVariableTypesByName.get(varName);
    if (explicitType) {
      return {
        type: explicitType,
        description: cached?.description,
        internal: cached?.internal,
      };
    }

    return cached ?? null;
  }

  accumulateGeneric(name: string, constraint: string): void {
    if (this.ctx.generics) {
      this.ctx.generics = [`${this.ctx.generics[0]}, ${name}`, `${this.ctx.generics[1]}, ${constraint}`];
    } else {
      this.ctx.generics = [name, constraint];
    }
  }

  /**
   * Resets parser state for reuse between parses.
   *
   * @example
   * ```ts
   * parser.parseSvelteComponent(source1, diagnostics1);
   * parser.cleanup();
   * parser.parseSvelteComponent(source2, diagnostics2);
   * ```
   */
  public cleanup() {
    this.ctx = createParserContext();
  }

  private static readonly SCRIPT_BLOCK_REGEX = /(<script[^>]*>)([\s\S]*?)(<\/script>)/gi;

  private static readonly TS_DIRECTIVE_REGEX = /\/\/\s*@ts-[^\n\r]*/g;

  private static stripTypeScriptDirectivesFromScripts(source: string): string {
    // Every directive contains `@ts-`; without it there's nothing to strip,
    // so skip the script-block regex replace (and the source copy it makes).
    if (!source.includes("@ts-")) return source;

    ComponentParser.SCRIPT_BLOCK_REGEX.lastIndex = 0;
    return source.replace(ComponentParser.SCRIPT_BLOCK_REGEX, (_match, openTag, scriptContent, closeTag) => {
      ComponentParser.TS_DIRECTIVE_REGEX.lastIndex = 0;
      const cleanedContent = scriptContent.replace(ComponentParser.TS_DIRECTIVE_REGEX, "");
      return openTag + cleanedContent + closeTag;
    });
  }

  /**
   * @example
   * ```ts
   * const parser = new ComponentParser();
   * const result = parser.parseSvelteComponent(source, {
   *   moduleName: "Button",
   *   filePath: "./Button.svelte"
   * });
   * // { props, slots, events, typedefs, ... }
   * ```
   */
  public parseSvelteComponent(source: string, diagnostics: ComponentParserDiagnostics): ParsedComponent {
    this.cleanup();
    this.ctx.componentFilePath = diagnostics.filePath;
    const cleanedSource = ComponentParser.stripTypeScriptDirectivesFromScripts(source);
    this.ctx.source = cleanedSource;

    /**
     * One modern-AST parse feeds both `buildRunesPropTypeMetadata` and the
     * main walk. There's no conversion step in between, so order doesn't matter.
     */
    const modernParsed = parseModernAst(cleanedSource);
    buildRunesPropTypeMetadata(this, this.ctx, modernParsed);
    this.ctx.parsed = modernParsed as unknown as ModernAstRoot;

    /**
     * compile() strips TS-only wrapper expressions (`as`/`satisfies`/`!`/type assertions/explicit
     * generic instantiation) before exposing its AST; parse() alone leaves them in place. Only
     * TS-tagged scripts can contain them, so skip the walk entirely for plain JS components.
     */
    if (this.ctx.scriptLanguage === "ts") {
      stripTypeCastWrappers(this.ctx.parsed.module);
      stripTypeCastWrappers(this.ctx.parsed.instance);
      stripTypeCastWrappers(this.ctx.parsed.fragment);
    }

    this.ctx.syntaxMode = detectSyntaxMode(this.ctx);

    /**
     * `parseCustomTypes` scans the raw source text for `/** *\/`-style comment blocks
     * (via `comment-parser`), which has no notion of Svelte's markup structure - a
     * `/** ... *\/`-shaped comment inside a top-level `<style>` block would otherwise be
     * misread as a JSDoc block and could produce a spurious typedef/event/etc. Blank out
     * the style block's own text (same length, so it doesn't shift any offsets) for this
     * scan only; `this.ctx.source` itself stays the untouched parsed source so every other
     * offset computation (source ranges, `sourceAtPos`, ...) is unaffected.
     */
    const cssBlock = this.ctx.parsed.css;
    const scanSource =
      cssBlock?.start !== undefined && cssBlock?.end !== undefined
        ? cleanedSource.slice(0, cssBlock.start) +
          " ".repeat(cssBlock.end - cssBlock.start) +
          cleanedSource.slice(cssBlock.end)
        : cleanedSource;

    /**
     * Imports and function declarations hoist, so `export let id = uniqueId()` must
     * resolve even when the import or `function uniqueId()` comes later in the script
     * (see #410) - and `parseCustomTypes` below needs `ctx.funcDecls` populated too, to
     * tell a `@template` tag documenting an ordinary function apart from one declaring a
     * component generic (see `blockDocumentsFunction` in `parser/jsdoc.ts`).
     *
     * Skip `componentRoot`. Imports and function declarations never appear in the template
     * fragment, so walking markup here would re-traverse the largest part of the AST for nothing.
     */
    collectHoistedScriptBindings(this.ctx, this.ctx.parsed?.module as unknown as Node | undefined);
    collectHoistedScriptBindings(this.ctx, this.ctx.parsed?.instance as unknown as Node | undefined);

    parseCustomTypes(this.ctx, this, scanSource);

    const componentRoot = {
      type: "ComponentRoot",
      instance: this.ctx.parsed.instance,
      fragment: this.ctx.parsed.fragment,
    } as unknown as Node;

    /**
     * Not fused with the componentRoot walk below: `module` (`<script context="module">`) is a
     * disjoint AST rooted separately from `instance`/`html`, not a subtree reachable from either,
     * so there is no shared root to traverse once. Wrapping both in one synthetic root would
     * require branch-tracking to keep module-export handling (addModuleExport) from firing on
     * instance-level exports (addProp) and vice versa, for a pass that most components skip
     * entirely (module scripts are rare) - not worth the added complexity here.
     */
    if (this.ctx.parsed?.module) {
      const reExportableImports = collectReExportableImports(this.ctx.parsed.module);
      /** Records an `export ... from` (or `export { imported }`) as-is; the `.d.ts` writer emits it verbatim. */
      const addModuleReExport = (node: Node, name: string, reExport: ComponentPropReExport) => {
        const jsdocInfo = processNodeJSDoc(this.ctx, this, node);
        // Each `export * from` shares the name "*", so key those by source instead.
        this.addModuleExport(name === "*" ? `* from ${reExport.from}` : name, {
          name,
          kind: "re-export",
          description: jsdocInfo?.description,
          deprecated: jsdocInfo?.deprecated,
          tags: jsdocInfo?.tags,
          ...(jsdocInfo?.internal ? { internal: true as const } : {}),
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
          reExport,
          source: sourceRangeFromNode(this.ctx, node),
        });
      };
      const addModuleDeclarationExports = (
        node: ExportNamedDeclaration,
        declaration: NonNullable<ExportNamedDeclaration["declaration"]>,
        specifier?: ResolvedExportSpecifier,
      ) => {
        type ModuleExportDeclarator = {
          prop_name: string;
          kind: "let" | "const" | "function";
          isFunctionDeclaration: boolean;
          value: string | undefined;
          typeSeed: string | undefined;
          explicitType: string | undefined;
          initializerIsFunction: boolean;
          defaultValue: ComponentPropDefaultValue | undefined;
          inferredTypeForSource: string | undefined;
          resolvedJSDoc:
            | Pick<
                ProcessedInitializer,
                "resolvedType" | "resolvedDescription" | "resolvedParams" | "resolvedReturnType" | "pendingCallDefault"
              >
            | undefined;
        };
        const declarators: ModuleExportDeclarator[] = [];

        if (declaration.type === "FunctionDeclaration") {
          const funcDecl = declaration as { id?: { name?: string } } & FunctionDeclarationLike;
          if (!funcDecl.id?.name) return;
          const accessorSignature =
            this.ctx.scriptLanguage === "ts" ? buildFunctionDeclarationSignature(this.ctx, funcDecl) : undefined;
          declarators.push({
            prop_name: specifier?.exportedName ?? funcDecl.id.name,
            kind: "function",
            isFunctionDeclaration: true,
            value: undefined,
            typeSeed: accessorSignature?.hasAnnotations ? undefined : "() => any",
            explicitType: accessorSignature?.hasAnnotations ? accessorSignature.signature : undefined,
            initializerIsFunction: true,
            defaultValue: undefined,
            inferredTypeForSource: undefined,
            resolvedJSDoc: undefined,
          });
        } else if (declaration.type === "VariableDeclaration") {
          const varDecl = declaration as VariableDeclaration;
          const kind = variableDeclarationKindToComponentPropKind(varDecl.kind);
          const declaratorsToProcess = specifier?.declarator ? [specifier.declarator] : varDecl.declarations;

          for (const declarator of declaratorsToProcess) {
            if (!declarator || typeof declarator !== "object" || !("id" in declarator)) {
              continue;
            }

            const { id, init } = declarator as VariableDeclarator;

            if (!id || typeof id !== "object") {
              continue;
            }

            if (id.type !== "Identifier") {
              // `export const { a, b } = obj`: each name is an export with no inferable type.
              for (const localPropName of collectPatternIdentifiers(id)) {
                if (specifier && specifier.localName !== localPropName) continue;
                declarators.push({
                  prop_name: specifier?.exportedName ?? localPropName,
                  kind,
                  isFunctionDeclaration: false,
                  value: undefined,
                  typeSeed: undefined,
                  explicitType: undefined,
                  initializerIsFunction: false,
                  defaultValue: undefined,
                  inferredTypeForSource: undefined,
                  resolvedJSDoc: undefined,
                });
              }
              continue;
            }

            const localPropName = id.name;
            const declaratorPropName = specifier?.exportedName ?? localPropName;
            const initResult = init == null ? { isFunction: false } : processInitializer(this, this.ctx, init);
            const { value, type: typeSeed, isFunction: initializerIsFunction, defaultValue } = initResult;
            const resolvedJSDoc = initResult;
            queuePendingCrossFileDefault(this.ctx, initResult, declaratorPropName, "moduleExports");

            declarators.push({
              prop_name: declaratorPropName,
              kind,
              isFunctionDeclaration: false,
              value,
              typeSeed,
              explicitType: this.getExplicitPropType(localPropName),
              initializerIsFunction,
              defaultValue,
              inferredTypeForSource: typeSeed,
              resolvedJSDoc,
            });
          }

          if (declarators.length === 0) return;
        } else {
          if (declaration.type === "ClassDeclaration" && declaration.id) {
            this.recordClassExport(node, specifier?.exportedName ?? declaration.id.name);
          }
          return;
        }

        const jsdocInfo = this.exportJSDoc(node, specifier);

        for (const {
          prop_name,
          kind,
          isFunctionDeclaration,
          value,
          typeSeed,
          explicitType,
          initializerIsFunction,
          defaultValue,
          inferredTypeForSource,
          resolvedJSDoc,
        } of declarators) {
          const { type, typeSource, description, params, returnType, isFunction, typeParameters } =
            resolvePropTypeAndDocs({
              explicitType,
              typeSeed,
              inferredTypeForSource,
              jsdocType: jsdocInfo?.type,
              jsdocDescription: jsdocInfo?.description,
              jsdocParams: jsdocInfo?.params,
              jsdocReturnType: jsdocInfo?.returnType,
              jsdocTypeParameters: jsdocInfo?.typeParameters,
              resolvedType: resolvedJSDoc?.resolvedType,
              resolvedDescription: resolvedJSDoc?.resolvedDescription,
              resolvedParams: resolvedJSDoc?.resolvedParams,
              resolvedReturnType: resolvedJSDoc?.resolvedReturnType,
              initializerIsFunction,
              isFunctionDeclaration,
              typedefs: this.ctx.typedefs,
            });

          this.addModuleExport(prop_name, {
            name: prop_name,
            kind,
            description,
            deprecated: jsdocInfo?.deprecated,
            tags: jsdocInfo?.tags,
            ...(jsdocInfo?.internal ? { internal: true as const } : {}),
            type,
            typeSource,
            value,
            defaultValue,
            params,
            returnType,
            typeParameters,
            isFunction,
            isFunctionDeclaration,
            isRequired: false,
            constant: kind === "const",
            reactive: false,
            source: sourceRangeFromNode(this.ctx, node),
          });
        }
      };

      walkNodes(
        this.ctx.parsed?.module as unknown as WalkableNode,
        ((node: Node, parent: Node | null) => {
          // Module script is in scope for instance. Record imports/funcs/vars
          // the same way so instance CallExpression defaults can see them.
          if (node.type === "ImportDeclaration") {
            collectValueImportBindings(this.ctx, node as unknown as ImportDeclarationNode);
          }

          if (node.type === "FunctionDeclaration") {
            const funcDecl = node as unknown as FunctionDeclaration;
            if (funcDecl.id?.name) {
              this.ctx.funcDecls.set(funcDecl.id.name, funcDecl);
            }
          }

          if (node.type === "VariableDeclaration") {
            this.ctx.vars.add(node as unknown as VariableDeclaration);
          }

          if (node.type === "ExportNamedDeclaration") {
            if (node.declaration != null) {
              addModuleDeclarationExports(node, node.declaration);
              return;
            }
            const from = node.source?.value;
            for (const specifier of node.specifiers) {
              const resolved = this.resolveExportSpecifier(node, specifier, parent, "module");
              if (!resolved) continue;
              if (resolved.exportedName === "default") {
                recordDiagnostic(
                  this.ctx,
                  "module-export-conflict",
                  resolved.exportedName,
                  'export "default" was skipped because it collides with the component\'s own default export.',
                  sourceRangeFromNode(this.ctx, node),
                );
                continue;
              }
              const reExport =
                typeof from === "string"
                  ? { from, imported: resolved.localName }
                  : reExportableImports.get(resolved.localName);
              if (resolved.declaration) {
                addModuleDeclarationExports(node, resolved.declaration, resolved);
              } else if (reExport) {
                addModuleReExport(node, resolved.exportedName, reExport);
              } else if (!this.ctx.localTypeDeclarationsByName.get(resolved.localName)?.exported) {
                // A type exported this way is emitted with the module's other types.
                this.recordUnresolvedExportSpecifier(node, resolved.localName, resolved.exportedName);
              }
            }
          }

          if (node.type === "ExportAllDeclaration" && typeof node.source.value === "string") {
            const name = (node.exported && moduleExportName(node.exported)) ?? "*";
            addModuleReExport(node, name, { from: node.source.value, imported: "*" });
          }
        }) as unknown as WalkEnter,
      );
    }

    let dispatcher_name: undefined | string;
    let dispatcherDeclaratorNode: unknown;
    let dispatcherTypeArgument: ModernRunesTypeNode | undefined;
    const hostLocalNames = new Set<string>();
    const hostDispatchedEventNames = new Set<string>();
    // Source ranges are resolved lazily below: only calls to the dispatcher
    // need one, and most components' call expressions aren't dispatches.
    const callees: { name: string; arguments: Array<Expression | unknown>; node: CallExpression }[] = [];
    /** Every call with arguments, any callee: checked for the dispatcher escaping once its name is known. */
    const callsWithArguments: CallExpression[] = [];

    initComponentScope(this, this.ctx);
    this.ctx.activeScopes.push(this.ctx.componentScope);
    const scopeWalkState = createScopeWalkState(this.ctx);

    const addInstanceDeclarationExports = (
      node: ExportNamedDeclaration,
      declaration: NonNullable<ExportNamedDeclaration["declaration"]>,
      specifier?: ResolvedExportSpecifier,
    ) => {
      type InstancePropDeclarator = {
        prop_name: string;
        kind: "let" | "const" | "function";
        isFunctionDeclaration: boolean;
        value: string | undefined;
        typeSeed: string | undefined;
        explicitType: string | undefined;
        initializerIsFunction: boolean;
        isRequired: boolean;
        localName: string | undefined;
        defaultValue: ComponentPropDefaultValue | undefined;
        inferredTypeForSource: string | undefined;
        resolvedJSDoc:
          | Pick<
              ProcessedInitializer,
              "resolvedType" | "resolvedDescription" | "resolvedParams" | "resolvedReturnType" | "pendingCallDefault"
            >
          | undefined;
      };
      const declarators: InstancePropDeclarator[] = [];

      if (declaration.type === "FunctionDeclaration") {
        const funcDecl = declaration as { id?: { name?: string } } & FunctionDeclarationLike;
        if (!funcDecl.id?.name) return;
        const prop_name = specifier?.exportedName ?? funcDecl.id.name;
        const accessorSignature =
          this.ctx.scriptLanguage === "ts" ? buildFunctionDeclarationSignature(this.ctx, funcDecl) : undefined;
        declarators.push({
          prop_name,
          kind: "function",
          isFunctionDeclaration: true,
          value: undefined,
          typeSeed: accessorSignature?.hasAnnotations ? undefined : "() => any",
          explicitType: accessorSignature?.hasAnnotations ? accessorSignature.signature : undefined,
          initializerIsFunction: true,
          isRequired: false,
          localName: funcDecl.id.name,
          defaultValue: undefined,
          inferredTypeForSource: undefined,
          resolvedJSDoc: undefined,
        });
      } else if (declaration.type === "VariableDeclaration") {
        const varDecl = declaration as VariableDeclaration;
        const kind = variableDeclarationKindToComponentPropKind(varDecl.kind);
        const declaratorsToProcess = specifier?.declarator ? [specifier.declarator] : varDecl.declarations;

        for (const declarator of declaratorsToProcess) {
          if (!declarator || typeof declarator !== "object" || !("id" in declarator)) {
            continue;
          }

          const { id, init } = declarator as VariableDeclarator;
          if (!id || typeof id !== "object") {
            continue;
          }

          if (id.type !== "Identifier") {
            // `export let { a, b } = obj`: each name is a prop, defaulting to
            // its part of `obj`, with no inferable type.
            for (const localPropName of collectPatternIdentifiers(id)) {
              if (specifier && specifier.localName !== localPropName) continue;
              declarators.push({
                prop_name: specifier?.exportedName ?? localPropName,
                kind,
                isFunctionDeclaration: false,
                value: undefined,
                typeSeed: undefined,
                explicitType: undefined,
                initializerIsFunction: false,
                isRequired: false,
                localName: localPropName,
                defaultValue: undefined,
                inferredTypeForSource: undefined,
                resolvedJSDoc: undefined,
              });
            }
            continue;
          }

          const localPropName = id.name;
          const declaratorPropName = specifier?.exportedName ?? localPropName;
          const isRequired = kind === "let" && init == null;
          const initResult = init == null ? { isFunction: false } : processInitializer(this, this.ctx, init);
          const { value, type: typeSeed, isFunction: initializerIsFunction, defaultValue } = initResult;
          const resolvedJSDoc = initResult;
          queuePendingCrossFileDefault(this.ctx, initResult, declaratorPropName, "props");

          declarators.push({
            prop_name: declaratorPropName,
            kind,
            isFunctionDeclaration: false,
            value,
            typeSeed,
            explicitType: this.getExplicitPropType(localPropName),
            initializerIsFunction,
            isRequired,
            localName: localPropName,
            defaultValue,
            inferredTypeForSource: typeSeed,
            resolvedJSDoc,
          });
        }

        if (declarators.length === 0) return;
      } else {
        if (declaration.type === "ClassDeclaration" && declaration.id) {
          this.recordClassExport(node, specifier?.exportedName ?? declaration.id.name);
        }
        return;
      }

      const jsdocInfo = this.exportJSDoc(node, specifier);

      for (const {
        prop_name,
        kind,
        isFunctionDeclaration,
        value,
        typeSeed,
        explicitType,
        initializerIsFunction,
        isRequired,
        localName,
        defaultValue,
        inferredTypeForSource,
        resolvedJSDoc,
      } of declarators) {
        const { type, typeSource, description, params, returnType, isFunction, typeParameters } =
          resolvePropTypeAndDocs({
            explicitType,
            typeSeed,
            inferredTypeForSource,
            jsdocType: jsdocInfo?.type,
            jsdocDescription: jsdocInfo?.description,
            jsdocParams: jsdocInfo?.params,
            jsdocReturnType: jsdocInfo?.returnType,
            jsdocTypeParameters: jsdocInfo?.typeParameters,
            resolvedType: resolvedJSDoc?.resolvedType,
            resolvedDescription: resolvedJSDoc?.resolvedDescription,
            resolvedParams: resolvedJSDoc?.resolvedParams,
            resolvedReturnType: resolvedJSDoc?.resolvedReturnType,
            initializerIsFunction,
            isFunctionDeclaration,
            typedefs: this.ctx.typedefs,
          });

        recordSveldIgnore(this.ctx, "prop-unknown-type", prop_name, jsdocInfo?.sveldIgnore);

        addProp(this, this.ctx, prop_name, {
          name: prop_name,
          ...(localName !== undefined && localName !== prop_name ? { localName } : {}),
          kind,
          description,
          binding: jsdocInfo?.binding,
          deprecated: jsdocInfo?.deprecated,
          tags: jsdocInfo?.tags,
          ...(jsdocInfo?.internal ? { internal: true as const } : {}),
          type,
          typeSource,
          value,
          defaultValue,
          params,
          returnType,
          typeParameters,
          isFunction,
          isFunctionDeclaration,
          isRequired,
          constant: kind === "const",
          reactive: this.ctx.reactive_vars.has(prop_name),
          source: sourceRangeFromNode(this.ctx, node),
        });
      }
    };

    walkNodes(
      componentRoot as unknown as WalkableNode,
      ((node: Node, parent: Node | null, _prop: string | null) => {
        // Fuse scope declaration into this walk (see enterNestedScopeDeclarationNode).
        // Only scope-owner nodes get a scope, so the returned scope is the
        // same one a `scopeDeclarations.get(node)` lookup would find.
        const nodeScope = enterNestedScopeDeclarationNode(this, this.ctx, scopeWalkState, node);
        if (nodeScope) {
          this.ctx.activeScopes.push(nodeScope);
        }

        // Svelte template node types aren't in estree's `Node["type"]` union;
        // read the type once as a plain string for the markup checks below.
        const type: string = node.type;

        // Every check below is keyed on one of these types; most nodes
        // (identifiers, literals, text, elements) match none of them.
        if (!MAIN_WALK_NODE_TYPES.has(type)) return;

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
              dispatcherDeclaratorNode = parent;
            }
            dispatcherTypeArgument = (callExpr as unknown as { typeArguments?: { params?: ModernRunesTypeNode[] } })
              .typeArguments?.params?.[0];
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

          if (callExpr.arguments.length > 0) callsWithArguments.push(callExpr);

          if (calleeName) {
            callees.push({
              name: calleeName,
              arguments: callExpr.arguments,
              node: callExpr,
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

        // Svelte spread attribute nodes: `{...$$restProps}` and rest-prop locals.
        if (type === "SpreadAttribute") {
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

        if (node.type === "ImportDeclaration") {
          collectValueImportBindings(this.ctx, node as unknown as ImportDeclarationNode);
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
          if (node.declaration != null) {
            addInstanceDeclarationExports(node, node.declaration);
            return;
          }
          for (const specifier of node.specifiers) {
            const resolved = this.resolveExportSpecifier(node, specifier, parent, "instance");
            if (!resolved) continue;
            if (resolved.declaration) {
              addInstanceDeclarationExports(node, resolved.declaration, resolved);
            } else {
              this.recordUnresolvedExportSpecifier(node, resolved.localName, resolved.exportedName);
            }
          }
        }

        if (type === "Comment") {
          const commentNode = node as { data?: string };
          const data: string = commentNode?.data?.trim() ?? "";

          if (COMPONENT_COMMENT_REGEX.test(data)) {
            this.ctx.componentComment = data.replace(COMPONENT_COMMENT_REGEX, "").replace(CARRIAGE_RETURN_REGEX, "");
            this.ctx.componentCommentSource = sourceRangeFromNode(this.ctx, node);
          }
        }

        if (type === "SlotElement") {
          type AttributeValueChunk = {
            type?: string;
            expression?: unknown;
            raw?: string;
            start?: number;
            end?: number;
            data?: string;
          };
          const slotNode = node as {
            attributes?: Array<{
              name?: string;
              value?: true | AttributeValueChunk | AttributeValueChunk[];
            }>;
            fragment?: { nodes?: Array<{ start?: number; end?: number }> };
          };
          const nameAttributeValue = slotNode.attributes?.find((attr) => attr.name === "name")?.value;
          const slot_name = (Array.isArray(nameAttributeValue) ? nameAttributeValue[0] : undefined)?.data;

          const slot_props = (slotNode.attributes || [])
            .filter((attr) => attr.name !== "name")
            .reduce<SlotProps>((slot_props, attr) => {
              const slot_prop_value: SlotPropValue = {
                value: undefined,
                replace: false,
              };

              const value = attr.value;
              if (value === undefined || value === true) return slot_props;

              // Quoted or multi-chunk values are an array. A single expression
              // (`name={expr}` or `{name}`) is unwrapped. Modern AST doesn't
              // distinguish those two.
              const firstValue = Array.isArray(value) ? value[0] : value;

              if (firstValue) {
                const { type, expression, raw, start, end } = firstValue;

                if (type === "Text" && raw !== undefined) {
                  slot_prop_value.value = JSON.stringify(raw);
                } else if (
                  !Array.isArray(value) &&
                  type === "ExpressionTag" &&
                  expression &&
                  typeof expression === "object" &&
                  "type" in expression &&
                  expression.type === "Identifier" &&
                  "name" in expression &&
                  expression.name === attr.name
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

          const fallback = (slotNode.fragment?.nodes as TemplateNode[] | undefined)
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

        if (type === "RenderTag") {
          const renderTag = node as { expression?: unknown };
          const renderInfo = extractRenderTagInfo(this.ctx, renderTag.expression);
          if (renderInfo) {
            let slot_props: SlotProps | undefined;
            let slot_props_unresolved_spread = false;
            if (renderInfo.arguments.length === 0) {
              slot_props = {};
            } else if (
              renderInfo.arguments.length === 1 &&
              typeof renderInfo.arguments[0] === "object" &&
              renderInfo.arguments[0] &&
              "type" in renderInfo.arguments[0] &&
              renderInfo.arguments[0].type === "ObjectExpression"
            ) {
              const built = buildSlotPropsFromObjectExpression(
                this.ctx,
                this,
                renderInfo.arguments[0] as ObjectExpression,
              );
              slot_props = built.slot_props;
              slot_props_unresolved_spread = built.hasUnresolvedSpread;
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
                slot_props_unresolved_spread: slot_props_unresolved_spread || undefined,
                source: sourceRangeFromNode(this.ctx, node),
              });
            }

            if (slot_props !== undefined || this.ctx.slots.has(slotKey)) {
              this.ctx.snippetPropLocals.add(renderInfo.trackingName);
            }
          }
        }

        // Bare `on:event` handlers forward events; dispatched events win and are reconciled after the walk.
        if (type === "OnDirective") {
          const eventHandlerNode = node as { expression?: unknown; name?: string };
          if (eventHandlerNode.expression == null && eventHandlerNode.name) {
            if (parent != null && typeof parent === "object" && "name" in parent) {
              const parentName = typeof parent.name === "string" ? parent.name : undefined;
              const parentType = "type" in parent ? String(parent.type) : undefined;
              if (parentName && parentType) {
                const element: ComponentInlineElement | ComponentElement = isComponentLikeType(parentType)
                  ? { type: "InlineComponent", name: parentName }
                  : { type: "Element", name: parentName };

                this.ctx.forwardedEvents.set(eventHandlerNode.name, element);

                const existing_event = this.ctx.events.get(eventHandlerNode.name);

                const event_description = this.ctx.eventDescriptions.get(eventHandlerNode.name);
                const event_deprecated = existing_event?.deprecated;
                const event_internal = existing_event?.internal;

                if (!existing_event) {
                  this.ctx.events.set(eventHandlerNode.name, {
                    type: "forwarded",
                    name: eventHandlerNode.name,
                    element: element,
                    description: event_description,
                    deprecated: event_deprecated,
                    ...(event_internal ? { internal: true as const } : {}),
                    source: sourceRangeFromNode(this.ctx, node),
                  });
                } else if (existing_event.type === "forwarded" && event_description && !existing_event.description) {
                  this.ctx.events.set(eventHandlerNode.name, {
                    ...existing_event,
                    description: event_description,
                    deprecated: existing_event.deprecated ?? event_deprecated,
                    ...(existing_event.internal || event_internal ? { internal: true as const } : {}),
                    source: existing_event.source || sourceRangeFromNode(this.ctx, node),
                  });
                }
              }
            }
          }
        }

        /**
         * `bind:*` marks props reactive; `bind:this` on elements also narrows the prop type.
         */
        if (
          type === "BindDirective" &&
          parent &&
          typeof parent === "object" &&
          "type" in parent &&
          (isElementLikeType(String(parent.type)) || isComponentLikeType(String(parent.type)))
        ) {
          const bindingNode = node as { name?: string; expression?: { name?: string } };
          if (bindingNode.expression?.name) {
            const prop_name = resolveIdentifierToReactiveProp(this.ctx, bindingNode.expression.name);
            if (prop_name) {
              this.ctx.reactive_vars.add(prop_name);
            }
          }

          if (
            isElementLikeType(String(parent.type)) &&
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
      }) as unknown as WalkEnter,
      ((node: Node) => {
        // Scopes exist exactly for scope-owner nodes (see `enter` above), and
        // function-scope owners are a subset, so one type check covers both.
        if (isScopeOwner(node)) {
          this.ctx.activeScopes.pop();
          leaveNestedScopeDeclarationNode(scopeWalkState, node);
        }
      }) as unknown as WalkLeave,
      // Every type this walk acts on is value-level (calls, declarations,
      // assignments, directives, slots), and scopes only come from
      // functions/blocks, so type-level TS subtrees have nothing for it.
      { skipTypeOnlySubtrees: true },
    );

    if (dispatcher_name !== undefined) {
      registerTypedDispatcherEvents(
        this,
        this.ctx,
        dispatcherTypeArgument,
        dispatcher_name,
        sourceRangeFromNode(this.ctx, dispatcherDeclaratorNode),
      );

      for (const callee of callees) {
        if (callee.name === dispatcher_name) {
          const firstArg = callee.arguments[0];
          const event_name =
            firstArg && typeof firstArg === "object" && "value" in firstArg ? (firstArg as Literal).value : undefined;
          const event_argument = callee.arguments[1];
          const structuralDetail = deriveLiteralDetailType(this, event_argument);
          const event_detail =
            structuralDetail === undefined &&
            event_argument &&
            typeof event_argument === "object" &&
            "value" in event_argument
              ? (event_argument as Literal).value
              : undefined;

          if (event_name != null) {
            addDispatchedEvent(this.ctx, {
              name: String(event_name),
              detail: structuralDetail ?? (event_detail == null ? "" : literalDetailToTypeText(event_detail)),
              has_argument: Boolean(event_argument),
              source: sourceRangeFromNode(this.ctx, callee.node),
            });
          }
        }
      }
    }

    // Reconcile `@event` JSDoc with actual dispatch vs `on:` forwarding.
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
        if (event.internal) {
          forwardedEvent.internal = true;
        }
        // Keep explicit `@event` detail types, including `null`.
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
        const { slot_props_unresolved_spread, ...publicSlot } = slot;

        // JSDoc `@slot`/`@snippet` tags are already TS type text; template parsing yields a SlotProps map.
        if (!slot.slot_props) {
          return publicSlot as ComponentSlot;
        }
        if (typeof slot.slot_props === "string") {
          return EMPTY_OBJECT_TYPE_REGEX.test(slot.slot_props)
            ? { ...publicSlot, slot_props: "Record<string, never>" }
            : (publicSlot as ComponentSlot);
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

        const widenSuffix = slot_props_unresolved_spread ? " & Record<string, any>" : "";

        // Force multiline when count > 1 (matches interface body formatting).
        const formatted_slot_props =
          new_props.length === 0
            ? slot_props_unresolved_spread
              ? "Record<string, any>"
              : "Record<string, never>"
            : new_props.length === 1
              ? `{ ${new_props[0]} }${widenSuffix}`
              : `{\n  ${new_props.join(";\n  ")};\n}${widenSuffix}`;

        return { ...publicSlot, slot_props: formatted_slot_props };
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
    // Forwarded events keep element objects internally; JSON output uses element name strings.
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
      .sort(compareSerializedEvents);
    const typedefsArray = ComponentParser.mapToArray(this.ctx.typedefs);
    const contextsArray = ComponentParser.mapToArray(this.ctx.contexts);

    const pendingCallDefaultsByLocation = {
      props: new Map(
        this.ctx.pendingCallDefaultCandidates.filter((c) => c.location === "props").map((c) => [c.propName, c]),
      ),
      moduleExports: new Map(
        this.ctx.pendingCallDefaultCandidates.filter((c) => c.location === "moduleExports").map((c) => [c.propName, c]),
      ),
    };

    for (const prop of processedProps) {
      if (prop.typeSource === "unknown") {
        const callDefault = pendingCallDefaultsByLocation.props.get(prop.name);
        // Never leave type unset: the writer would emit `id?: undefined;`.
        if (callDefault) prop.type = "any";

        const message = callDefault
          ? callDefault.importSource
            ? `Prop "${prop.name}" default calls "${callDefault.calleeName}()" imported from "${callDefault.importSource}"; falling back to "any" pending cross-file resolution.`
            : `Prop "${prop.name}" default calls "${callDefault.calleeName}()", but its return type could not be inferred; falling back to "any".`
          : `Prop "${prop.name}" type could not be inferred; falling back to "${prop.type ?? "any"}".`;

        recordDiagnostic(this.ctx, "prop-unknown-type", prop.name, message, prop.source);
      }
    }

    for (const moduleExport of moduleExportsArray) {
      if (moduleExport.typeSource === "unknown" && pendingCallDefaultsByLocation.moduleExports.has(moduleExport.name)) {
        moduleExport.type = "any";
      }
    }

    /**
     * The dispatcher handed to another function (`helper(dispatch)`). For an
     * imported function, `generateBundle` reads the events it dispatches
     * (see `resolve-dispatch-escapes.ts`). Any other callee can't be followed.
     */
    const dispatcherName = dispatcher_name;
    const unfollowableEscapes: CallExpression[] = [];
    if (dispatcherName !== undefined) {
      const escapes: Array<{ call: CallExpression; argumentIndex: number; property?: string }> = [];
      for (const call of callsWithArguments) {
        const passed = findDispatcherArgument(call, dispatcherName);
        if (passed) escapes.push({ call, ...passed });
      }
      if (escapes.length > 0) {
        recordSveldIgnore(
          this.ctx,
          "dispatch-escapes",
          dispatcherName,
          this.resolveLocalVarJSDoc(dispatcherName)?.sveldIgnore,
        );
      }
      const ignored = isSveldIgnored(this.ctx, "dispatch-escapes", dispatcherName);
      for (const { call, argumentIndex, property } of escapes) {
        const importBinding = isIdentifier(call.callee)
          ? this.ctx.valueImportBindingsByLocalName.get(call.callee.name)
          : undefined;
        if (!importBinding) {
          unfollowableEscapes.push(call);
          continue;
        }
        const source = sourceRangeFromNode(this.ctx, call);
        this.ctx.pendingDispatchEscapeCandidates.push({
          importSource: importBinding.source,
          importedName: importBinding.importedName,
          calleeText: sourceForExpression(this.ctx, call.callee) ?? importBinding.importedName,
          dispatcherName,
          argumentIndex,
          ...(property === undefined ? {} : { property }),
          ...(source ? { source } : {}),
          ...(ignored ? { ignored } : {}),
        });
      }
    }

    /**
     * `@event` in JSDoc with no `createEventDispatcher`, `on:` forward,
     * or `on<event>` callback prop. While the dispatcher escapes, such an
     * event may come from the function it escapes to: an imported one gets
     * checked once its events are known, anything else gets the benefit of
     * the doubt.
     */
    for (const eventName of this.ctx.jsDocEventNames) {
      if (actuallyDispatchedEvents.has(eventName)) continue;
      if (this.ctx.forwardedEvents.has(eventName)) continue;
      if (this.ctx.props.has(`on${eventName}`)) continue;
      if (unfollowableEscapes.length > 0) continue;
      const diagnostic = buildDiagnostic(
        this.ctx,
        "event-no-source",
        eventName,
        `@event "${eventName}" has no matching dispatch or callback prop.`,
        this.ctx.jsDocEventSources.get(eventName),
      );
      if (this.ctx.pendingDispatchEscapeCandidates.length > 0) {
        this.ctx.deferredEventNoSourceDiagnostics.push(diagnostic);
      } else {
        this.ctx.diagnosticRecords.push(diagnostic);
      }
    }

    for (const call of unfollowableEscapes) {
      const callee = sourceForExpression(this.ctx, call.callee) ?? "";
      recordDiagnostic(
        this.ctx,
        "dispatch-escapes",
        dispatcherName ?? "",
        `\`${dispatcherName}\` is passed to \`${callee}\`, which sveld can only follow when it's an imported function. Document the events dispatched there with @event tags.`,
        sourceRangeFromNode(this.ctx, call),
      );
    }

    /**
     * `{...$$restProps}` spread only onto components: sveld can't type another
     * component's rest-prop shape, and no `@restProps` tag supplied one manually.
     */
    if (this.ctx.rest_props?.type === "InlineComponent") {
      recordDiagnostic(
        this.ctx,
        "rest-props-unresolved",
        "$$restProps",
        `$$restProps is only spread onto component "${this.ctx.rest_props.name}"; sveld cannot infer its rest-prop type. Spread onto a plain element or add an @restProps tag.`,
      );
    }

    /**
     * A public prop/typedef/event/slot/module-export/context-property whose type
     * text still names a now-excluded `@internal` typedef leaves a dangling
     * reference in the generated `.d.ts`. Cheap early-out: most components
     * declare no `@internal` typedefs at all.
     */
    const internalTypedefNames = typedefsArray
      .filter((typedef) => typedef.internal)
      .map((typedef) => typedef.name.split("<")[0]);

    if (internalTypedefNames.length > 0) {
      const internalTypedefMatchers = internalTypedefNames.map((name) => ({
        name,
        regex: new RegExp(`\\b${name}\\b`),
      }));

      const scanForInternalReference = (
        referencingName: string,
        typeText: string | undefined,
        source?: SourceRange,
      ) => {
        if (!typeText) return;
        for (const { name: internalName, regex } of internalTypedefMatchers) {
          if (!regex.test(typeText)) continue;
          recordDiagnostic(
            this.ctx,
            "internal-typedef-referenced",
            referencingName,
            `"${referencingName}" references "${internalName}", which is @internal and excluded from output; the generated .d.ts will contain a dangling reference to it.`,
            source,
          );
        }
      };

      for (const prop of processedProps) {
        if (prop.internal) continue;
        scanForInternalReference(prop.name, prop.type, prop.source);
      }

      for (const moduleExport of moduleExportsArray) {
        if (moduleExport.internal) continue;
        scanForInternalReference(moduleExport.name, moduleExport.type, moduleExport.source);
      }

      for (const typedef of typedefsArray) {
        if (typedef.internal) continue;
        scanForInternalReference(typedef.name, typedef.ts);
      }

      for (const event of eventsArray) {
        if (event.internal || event.type !== "dispatched") continue;
        scanForInternalReference(event.name, event.detail, event.source);
      }

      for (const slot of processedSlots) {
        if (slot.internal) continue;
        scanForInternalReference(slot.name ?? "default", slot.slot_props, slot.source);
      }

      for (const context of contextsArray) {
        if (context.internal) continue;
        for (const property of context.properties) {
          scanForInternalReference(property.name, property.type);
        }
      }
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
      customElement: this.ctx.customElement,
      ...(this.ctx.cssParts.length > 0 ? { cssParts: this.ctx.cssParts.slice() } : {}),
      ...(this.ctx.cssProperties.length > 0 ? { cssProperties: this.ctx.cssProperties.slice() } : {}),
      diagnostics: this.ctx.diagnosticRecords.slice(),
    };

    const typeScriptMetadata = buildTypeScriptMetadata(this.ctx);
    if (typeScriptMetadata) {
      parsedComponent[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = typeScriptMetadata;
    }

    return parsedComponent;
  }
}
