import type { AST, FunctionDeclaration, TSNode, VariableDeclaration } from "sveast";
import type { SveldDiagnostic } from "../diagnostics";
import type {
  ComponentContext,
  ComponentCssPart,
  ComponentCssProperty,
  ComponentElement,
  ComponentEvent,
  ComponentGenerics,
  ComponentInlineElement,
  ComponentProp,
  ComponentPropBindings,
  CustomElementOptions,
  Extends,
  InternalComponentSlot,
  LexicalScope,
  LocalTypeDeclaration,
  PendingCallDefaultCandidate,
  PendingConstDefaultCandidate,
  PendingContextKeyCandidate,
  PendingDispatchEscapeCandidate,
  RestProps,
  RunesPropsDeclarationMetadata,
  ScriptLanguage,
  SourcePosition,
  SourceRange,
  SyntaxMode,
  TypeDef,
  TypeImportBinding,
  ValueImportBinding,
} from "../model";
import type { JSDocComment } from "./comment-parser";

/** One top-level member of an object `@typedef`, from a `@property` tag or an inline `{ ... }` type. */
export interface TypedefMember {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

/** Per-parse mutable state for {@link ComponentParser}. Reset via {@link createParserContext} on each parse. */
export interface ParserContext {
  syntaxMode: SyntaxMode;
  scriptLanguage?: ScriptLanguage;
  source?: string;
  parsed?: AST.Root;

  /** `<svelte:options runes={...} />`; overrides rune-reference detection. */
  runesOptionOverride?: boolean;

  /** Created lazily by `sourcePositionFromOffset`. */
  sourceLocator?: (offset: number) => SourcePosition;
  /** Parsed JSDoc blocks keyed by their formatted comment text. */
  readonly parsedJsDocByText: Map<string, JSDocComment[]>;
  /** Every `/** *\/` block `parseCustomTypes` found in the source, keyed by absolute start offset. */
  readonly jsDocBlocksByStart: Map<number, JSDocComment>;
  /** Starts of JSDoc blocks documenting a function, whose `@template` is the function's own. */
  functionDocCommentStarts: Set<number>;

  rest_props?: RestProps;
  extends?: Extends;
  customElementTag?: string;
  customElement?: CustomElementOptions;
  componentComment?: string;
  componentCommentSource?: SourceRange;
  generics: ComponentGenerics;

  /** `<script generics>`, held until parse end so it can override JSDoc-derived {@link ParserContext.generics}. */
  scriptGenericsAttribute?: { value: string; source?: SourceRange };

  readonly diagnosticRecords: SveldDiagnostic[];
  componentFilePath: string;

  readonly props: Map<string, ComponentProp>;
  readonly moduleExports: Map<string, ComponentProp>;
  readonly propLocalToPublicName: Map<string, string>;
  readonly reactive_vars: Set<string>;
  readonly funcDecls: Map<string, FunctionDeclaration>;
  readonly vars: Set<VariableDeclaration>;
  readonly valueImportBindingsByLocalName: Map<string, ValueImportBinding>;
  /** CallExpression defaults that still need a return type after AST parsing. */
  readonly pendingCallDefaultCandidates: PendingCallDefaultCandidate[];
  /** Identifier defaults bound to a named value import, resolved after AST parsing. */
  readonly pendingConstDefaultCandidates: PendingConstDefaultCandidate[];
  /** Imported `setContext` keys that need a string value after AST parsing. */
  readonly pendingContextKeyCandidates: PendingContextKeyCandidate[];
  /** Dispatchers passed to imported functions, resolved after AST parsing. */
  readonly pendingDispatchEscapeCandidates: PendingDispatchEscapeCandidate[];
  /** `event-no-source` diagnostics that wait on {@link pendingDispatchEscapeCandidates}. */
  readonly deferredEventNoSourceDiagnostics: SveldDiagnostic[];

  readonly runesPropsDeclarationMetadataByDeclaratorStart: Map<number, RunesPropsDeclarationMetadata>;
  readonly typedRunesPropsDeclarations: RunesPropsDeclarationMetadata[];
  readonly explicitPropTypesByName: Map<string, string>;
  readonly explicitVariableTypesByName: Map<string, string>;
  /** The annotation node behind each {@link explicitVariableTypesByName} entry. */
  readonly explicitVariableTypeNodesByName: Map<string, TSNode>;
  readonly typeImportBindingsByLocalName: Map<string, TypeImportBinding>;
  readonly localTypeDeclarationsByName: Map<string, LocalTypeDeclaration>;
  /** Type nodes read outside the whole-object `$props()` path whose dependencies the `.d.ts` still needs. */
  readonly additionalTypeDependencyNodes: TSNode[];
  readonly wholePropsLocals: Set<string>;
  readonly restPropLocals: Set<string>;

  readonly componentScope: LexicalScope;
  scopeDeclarations: Map<object, LexicalScope>;
  readonly activeScopes: LexicalScope[];

  readonly slots: Map<string | null, InternalComponentSlot>;
  readonly snippetPropLocals: Set<string>;
  /** `@slot`/`@snippet` tags by slot key, for `slot-not-rendered` diagnostics. */
  readonly jsDocSlots: Map<string | null, { tag: string; source?: SourceRange }>;
  /** Slot keys the template renders with `<slot>` or `{@render}`. */
  readonly renderedSlots: Set<string | null>;
  /** Set when slots may be forwarded or rendered where sveld can't see (`<Child {...$$props} />`). */
  slotsUntracked: boolean;

  /** From component-level `@csspart` JSDoc tags. */
  readonly cssParts: ComponentCssPart[];
  /** From component-level `@cssprop`/`@cssproperty` JSDoc tags. */
  readonly cssProperties: ComponentCssProperty[];

  /** `@template` tags from a `@slot`/`@snippet` block (no `@extends`), held until finalization. */
  deferredSlotBlockGenerics: Array<{ name: string; constraint: string }>;

  readonly events: Map<string, ComponentEvent>;
  readonly eventDescriptions: Map<string, string | undefined>;
  readonly forwardedEvents: Map<string, ComponentInlineElement | ComponentElement>;
  readonly jsDocEventNames: Set<string>;
  /** `@event` tags with no `{type}` or `@property`: their `null` detail gives way to a dispatch's. */
  readonly untypedJsDocEventNames: Set<string>;

  /** Source range per `@event` JSDoc tag, for `event-no-source` diagnostics. */
  readonly jsDocEventSources: Map<string, SourceRange | undefined>;

  readonly bindings: Map<string, ComponentPropBindings>;
  /** Expressions written with `as const`, whose wrapper was stripped. */
  readonly constAssertions: WeakSet<object>;
  readonly contexts: Map<string, ComponentContext>;
  readonly typedefs: Map<string, TypeDef>;
  /** So `/** @type {Props} *\/ let { ... } = $props()` can type each prop. */
  readonly typedefMembersByName: Map<string, TypedefMember[]>;
  /** No `type` for a variable whose JSDoc has no `@type` (a TS annotation may still type it). */
  variableInfoCache: Map<string, { type?: string; description?: string; internal?: boolean }>;

  variableInfoCacheBuilt: boolean;

  /** `@sveld-ignore` codes keyed by `"<kind>:<name>"`; see `recordSveldIgnore`. */
  readonly sveldIgnoreDirectives: Map<string, Set<string>>;
}

/** Fresh {@link ParserContext}. Keep in sync with new fields on {@link ParserContext}. */
export function createParserContext(): ParserContext {
  return {
    syntaxMode: "legacy",
    scriptLanguage: undefined,
    source: undefined,
    parsed: undefined,
    runesOptionOverride: undefined,
    sourceLocator: undefined,
    parsedJsDocByText: new Map(),
    jsDocBlocksByStart: new Map(),
    functionDocCommentStarts: new Set(),
    rest_props: undefined,
    extends: undefined,
    customElementTag: undefined,
    customElement: undefined,
    componentComment: undefined,
    componentCommentSource: undefined,
    generics: null,
    scriptGenericsAttribute: undefined,
    diagnosticRecords: [],
    componentFilePath: "",
    props: new Map(),
    moduleExports: new Map(),
    propLocalToPublicName: new Map(),
    reactive_vars: new Set(),
    funcDecls: new Map(),
    vars: new Set(),
    valueImportBindingsByLocalName: new Map(),
    pendingCallDefaultCandidates: [],
    pendingConstDefaultCandidates: [],
    pendingContextKeyCandidates: [],
    pendingDispatchEscapeCandidates: [],
    deferredEventNoSourceDiagnostics: [],
    runesPropsDeclarationMetadataByDeclaratorStart: new Map(),
    typedRunesPropsDeclarations: [],
    explicitPropTypesByName: new Map(),
    explicitVariableTypesByName: new Map(),
    explicitVariableTypeNodesByName: new Map(),
    typeImportBindingsByLocalName: new Map(),
    localTypeDeclarationsByName: new Map(),
    additionalTypeDependencyNodes: [],
    wholePropsLocals: new Set(),
    restPropLocals: new Set(),
    componentScope: new Map(),
    scopeDeclarations: new Map(),
    activeScopes: [],
    slots: new Map(),
    snippetPropLocals: new Set(),
    jsDocSlots: new Map(),
    renderedSlots: new Set(),
    slotsUntracked: false,
    cssParts: [],
    cssProperties: [],
    deferredSlotBlockGenerics: [],
    events: new Map(),
    eventDescriptions: new Map(),
    forwardedEvents: new Map(),
    jsDocEventNames: new Set(),
    untypedJsDocEventNames: new Set(),
    jsDocEventSources: new Map(),
    bindings: new Map(),
    constAssertions: new WeakSet(),
    contexts: new Map(),
    typedefs: new Map(),
    typedefMembersByName: new Map(),
    variableInfoCache: new Map(),
    variableInfoCacheBuilt: false,
    sveldIgnoreDirectives: new Map(),
  };
}

/** The public name of the prop bound locally as `name` (`let { class: klass } = $props()`), else `name`. */
export function resolvePublicPropName(ctx: ParserContext, name: string): string {
  return ctx.propLocalToPublicName.get(name) ?? name;
}

export function trackPropLocalName(ctx: ParserContext, propName: string, localName = propName): void {
  ctx.propLocalToPublicName.set(localName, propName);
}

export function getPropByLocalOrPublic(ctx: ParserContext, name: string): ComponentProp | undefined {
  return ctx.props.get(resolvePublicPropName(ctx, name));
}

export function getPropTypeByLocalOrPublic(ctx: ParserContext, name: string): string | undefined {
  return getPropByLocalOrPublic(ctx, name)?.type;
}
