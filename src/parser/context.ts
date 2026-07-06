import type { FunctionDeclaration, VariableDeclaration } from "estree";
import type { compile } from "svelte/compiler";
import type {
  ComponentContext,
  ComponentElement,
  ComponentEvent,
  ComponentGenerics,
  ComponentInlineElement,
  ComponentProp,
  ComponentPropBindings,
  ComponentSlot,
  Extends,
  LegacyAstRoot,
  LexicalScope,
  LocalTypeDeclaration,
  RestProps,
  RunesPropsDeclarationMetadata,
  ScriptLanguage,
  SourceRange,
  SyntaxMode,
  TypeDef,
  TypeImportBinding,
} from "../ComponentParser";
import type { SveldDiagnostic } from "../diagnostics";

/** Per-parse mutable state for {@link ComponentParser}. Reset via {@link createParserContext} on each parse. */
export interface ParserContext {
  // --- source ---

  /** Whether the component uses legacy or runes syntax according to compiler metadata */
  syntaxMode: SyntaxMode;

  /** Language used by the component's instance or module script, when supported */
  scriptLanguage?: ScriptLanguage;

  /** Raw source code of the Svelte component being parsed */
  source?: string;

  /** Compiled Svelte code containing extracted variables and AST */
  compiled?: ReturnType<typeof compile>;

  /** Parsed abstract syntax tree from the Svelte compiler */
  parsed?: LegacyAstRoot;

  /** Cached `ctx.source` split on newlines */
  sourceLinesCache?: string[];

  /** Cached 0-based source offsets for the start of each line */
  sourceLineStartOffsetsCache?: number[];

  // --- metadata ---

  /** Rest props configuration (e.g., `$$restProps`) if present in component */
  rest_props?: RestProps;

  /** Component extension information (e.g., `extends` attribute) */
  extends?: Extends;

  /** Custom-element tag name from `<svelte:options customElement="x-foo" />` (or the object form's `tag`), when present */
  customElementTag?: string;

  /** Component-level description extracted from `@component` HTML comment */
  componentComment?: string;

  /** Source range for the `@component` HTML comment, when available */
  componentCommentSource?: SourceRange;

  /** Component generic type parameters (null if no generics) */
  generics: ComponentGenerics;

  /** Diagnostics for the parse in progress. */
  readonly diagnosticRecords: SveldDiagnostic[];

  /** File path tagged onto each diagnostic. */
  componentFilePath: string;

  // --- props ---

  /** Map of component props keyed by prop name */
  readonly props: Map<string, ComponentProp>;

  /** Map of module exports (functions/variables exported from script) keyed by name */
  readonly moduleExports: Map<string, ComponentProp>;

  /** Maps local binding names back to their public prop names */
  readonly propLocalToPublicName: Map<string, string>;

  /** Set of reactive variable names found in the component */
  readonly reactive_vars: Set<string>;

  /** Function declarations in the component script, by name */
  readonly funcDecls: Map<string, FunctionDeclaration>;

  /** Set of all variable declarations found in the component script */
  readonly vars: Set<VariableDeclaration>;

  // --- runes/type metadata ---

  /** Per-declarator type metadata extracted from modern AST `$props()` annotations */
  readonly runesPropsDeclarationMetadataByDeclaratorStart: Map<number, RunesPropsDeclarationMetadata>;

  /** Typed `$props()` declarations discovered in source order */
  readonly typedRunesPropsDeclarations: RunesPropsDeclarationMetadata[];

  /** Explicit TypeScript prop annotations for legacy `export let` declarations keyed by local name */
  readonly explicitPropTypesByName: Map<string, string>;

  /** Type-only imports keyed by their local binding names */
  readonly typeImportBindingsByLocalName: Map<string, TypeImportBinding>;

  /** Local interface/type declarations keyed by type name */
  readonly localTypeDeclarationsByName: Map<string, LocalTypeDeclaration>;

  /** Tracks identifier bindings that capture the entire `$props()` object */
  readonly wholePropsLocals: Set<string>;

  /** Tracks `$props()` bindings that are used as spread/rest props */
  readonly restPropLocals: Set<string>;

  // --- scopes ---

  /** Component-level lexical scope shared by instance script and template */
  readonly componentScope: LexicalScope;

  /** Precomputed lexical scopes for nested AST nodes */
  scopeDeclarations: WeakMap<object, LexicalScope>;

  /** Active lexical scopes while walking the component AST */
  readonly activeScopes: LexicalScope[];

  // --- slots ---

  /** Map of component slots keyed by slot name (null for default slot) */
  readonly slots: Map<string | null, ComponentSlot>;

  /** Tracks prop locals that are used as snippet/render props */
  readonly snippetPropLocals: Set<string>;

  /** @template tags in a @slot/@snippet block (no @extends), held until finalization. */
  deferredSlotBlockGenerics: Array<{ name: string; constraint: string }>;

  // --- events ---

  /** Map of component events (dispatched events) keyed by event name */
  readonly events: Map<string, ComponentEvent>;

  /** Map of event descriptions extracted from JSDoc comments keyed by event name */
  readonly eventDescriptions: Map<string, string | undefined>;

  /** Map of forwarded events (events forwarded from child components) keyed by event name */
  readonly forwardedEvents: Map<string, ComponentInlineElement | ComponentElement>;

  /** `@event` names from JSDoc, checked against dispatches at end of parse. */
  readonly jsDocEventNames: Set<string>;

  /** Source range of each `@event` JSDoc tag, keyed by event name, for `event-no-source` diagnostics. */
  readonly jsDocEventSources: Map<string, SourceRange | undefined>;

  // --- contexts/bindings ---

  /** Map of prop bindings (e.g., `bind:value`) keyed by prop name */
  readonly bindings: Map<string, ComponentPropBindings>;

  /** Map of component contexts (created with `setContext`) keyed by context name */
  readonly contexts: Map<string, ComponentContext>;

  /** Map of type definitions (typedefs) extracted from JSDoc comments keyed by type name */
  readonly typedefs: Map<string, TypeDef>;

  /** Memoized `findVariableTypeAndDescription` results */
  variableInfoCache: Map<string, { type: string; description?: string }>;
}

/** Fresh {@link ParserContext}. Keep in sync with new fields on {@link ParserContext}. */
export function createParserContext(): ParserContext {
  return {
    // source
    syntaxMode: "legacy",
    scriptLanguage: undefined,
    source: undefined,
    compiled: undefined,
    parsed: undefined,
    sourceLinesCache: undefined,
    sourceLineStartOffsetsCache: undefined,

    // metadata
    rest_props: undefined,
    extends: undefined,
    customElementTag: undefined,
    componentComment: undefined,
    componentCommentSource: undefined,
    generics: null,
    diagnosticRecords: [],
    componentFilePath: "",

    // props
    props: new Map(),
    moduleExports: new Map(),
    propLocalToPublicName: new Map(),
    reactive_vars: new Set(),
    funcDecls: new Map(),
    vars: new Set(),

    // runes/type metadata
    runesPropsDeclarationMetadataByDeclaratorStart: new Map(),
    typedRunesPropsDeclarations: [],
    explicitPropTypesByName: new Map(),
    typeImportBindingsByLocalName: new Map(),
    localTypeDeclarationsByName: new Map(),
    wholePropsLocals: new Set(),
    restPropLocals: new Set(),

    // scopes
    componentScope: new Map(),
    scopeDeclarations: new WeakMap(),
    activeScopes: [],

    // slots
    slots: new Map(),
    snippetPropLocals: new Set(),
    deferredSlotBlockGenerics: [],

    // events
    events: new Map(),
    eventDescriptions: new Map(),
    forwardedEvents: new Map(),
    jsDocEventNames: new Set(),
    jsDocEventSources: new Map(),

    // contexts/bindings
    bindings: new Map(),
    contexts: new Map(),
    typedefs: new Map(),
    variableInfoCache: new Map(),
  };
}
