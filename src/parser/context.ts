import type { FunctionDeclaration, VariableDeclaration } from "estree";
import type {
  ComponentContext,
  ComponentElement,
  ComponentEvent,
  ComponentGenerics,
  ComponentInlineElement,
  ComponentProp,
  ComponentPropBindings,
  Extends,
  InternalComponentSlot,
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
  syntaxMode: SyntaxMode;
  scriptLanguage?: ScriptLanguage;
  source?: string;
  parsed?: LegacyAstRoot;

  /**
   * Explicit `<svelte:options runes={...} />` value. When set, overrides rune-reference detection.
   */
  runesOptionOverride?: boolean;

  sourceLinesCache?: string[];
  sourceLineStartOffsetsCache?: number[];

  rest_props?: RestProps;
  extends?: Extends;
  customElementTag?: string;
  componentComment?: string;
  componentCommentSource?: SourceRange;
  generics: ComponentGenerics;

  /**
   * Raw `generics` script attribute (with `lang="ts"` validated). Held until parse end so it can
   * override JSDoc-derived {@link ParserContext.generics}.
   */
  scriptGenericsAttribute?: { value: string; source?: SourceRange };

  readonly diagnosticRecords: SveldDiagnostic[];
  componentFilePath: string;

  readonly props: Map<string, ComponentProp>;
  readonly moduleExports: Map<string, ComponentProp>;
  readonly propLocalToPublicName: Map<string, string>;
  readonly reactive_vars: Set<string>;
  readonly funcDecls: Map<string, FunctionDeclaration>;
  readonly vars: Set<VariableDeclaration>;

  readonly runesPropsDeclarationMetadataByDeclaratorStart: Map<number, RunesPropsDeclarationMetadata>;
  readonly typedRunesPropsDeclarations: RunesPropsDeclarationMetadata[];
  readonly explicitPropTypesByName: Map<string, string>;
  readonly typeImportBindingsByLocalName: Map<string, TypeImportBinding>;
  readonly localTypeDeclarationsByName: Map<string, LocalTypeDeclaration>;
  readonly wholePropsLocals: Set<string>;
  readonly restPropLocals: Set<string>;

  readonly componentScope: LexicalScope;
  scopeDeclarations: WeakMap<object, LexicalScope>;
  readonly activeScopes: LexicalScope[];

  readonly slots: Map<string | null, InternalComponentSlot>;
  readonly snippetPropLocals: Set<string>;

  /** `@template` tags from a `@slot`/`@snippet` block (no `@extends`), held until finalization. */
  deferredSlotBlockGenerics: Array<{ name: string; constraint: string }>;

  readonly events: Map<string, ComponentEvent>;
  readonly eventDescriptions: Map<string, string | undefined>;
  readonly forwardedEvents: Map<string, ComponentInlineElement | ComponentElement>;
  readonly jsDocEventNames: Set<string>;

  /** Source range per `@event` JSDoc tag, for `event-no-source` diagnostics. */
  readonly jsDocEventSources: Map<string, SourceRange | undefined>;

  readonly bindings: Map<string, ComponentPropBindings>;
  readonly contexts: Map<string, ComponentContext>;
  readonly typedefs: Map<string, TypeDef>;
  variableInfoCache: Map<string, { type: string; description?: string }>;

  /** True after a whole-source scan populates {@link variableInfoCache}. */
  variableInfoCacheBuilt: boolean;
}

/** Fresh {@link ParserContext}. Keep in sync with new fields on {@link ParserContext}. */
export function createParserContext(): ParserContext {
  return {
    syntaxMode: "legacy",
    scriptLanguage: undefined,
    source: undefined,
    parsed: undefined,
    runesOptionOverride: undefined,
    sourceLinesCache: undefined,
    sourceLineStartOffsetsCache: undefined,
    rest_props: undefined,
    extends: undefined,
    customElementTag: undefined,
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
    runesPropsDeclarationMetadataByDeclaratorStart: new Map(),
    typedRunesPropsDeclarations: [],
    explicitPropTypesByName: new Map(),
    typeImportBindingsByLocalName: new Map(),
    localTypeDeclarationsByName: new Map(),
    wholePropsLocals: new Set(),
    restPropLocals: new Set(),
    componentScope: new Map(),
    scopeDeclarations: new WeakMap(),
    activeScopes: [],
    slots: new Map(),
    snippetPropLocals: new Set(),
    deferredSlotBlockGenerics: [],
    events: new Map(),
    eventDescriptions: new Map(),
    forwardedEvents: new Map(),
    jsDocEventNames: new Set(),
    jsDocEventSources: new Map(),
    bindings: new Map(),
    contexts: new Map(),
    typedefs: new Map(),
    variableInfoCache: new Map(),
    variableInfoCacheBuilt: false,
  };
}
