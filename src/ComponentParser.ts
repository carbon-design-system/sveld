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
import { detectSyntaxMode } from "./parser/runes-detection";
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
import { stripTypeCastWrappers } from "./parser/typescript-casts";
import { assignValueOrUndefined } from "./parser/utils";
import { parse } from "./svelte-parse";

/** Matches `const`/`let`/`function` declarations for JSDoc association. */
const VAR_DECLARATION_REGEX = /(?:const|let|function)\s+(\w+)\s*[=(]/;

export { assignValueOrUndefined as assignValue };

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

/** A parsed component prop. */
export interface ComponentProp {
  /** Public prop name. */
  name: string;
  /** `"let"` (required), `"const"` (default), or `"function"`. */
  kind: "let" | "const" | "function";
  /** True when declared with `const`. */
  constant: boolean;
  /** TypeScript type text. */
  type?: string;
  /** Conservative provenance for the prop type. */
  typeSource?: ComponentPropTypeSource;
  /** Local binding when it differs from the public name. */
  localName?: string;
  /** Default value as source text. */
  value?: string;
  /** Structured default value metadata for docs UIs. */
  defaultValue?: ComponentPropDefaultValue;
  /** From JSDoc. */
  description?: string;
  /** From JSDoc `@param` on function props. */
  params?: ComponentPropParam[];
  /** From JSDoc `@returns` on function props. */
  returnType?: string;
  /** True for arrow/function-expression props. */
  isFunction: boolean;
  /** True for `function` declarations. */
  isFunctionDeclaration: boolean;
  /** True when declared with `let` and no default. */
  isRequired: boolean;
  /** True when reactive. */
  reactive: boolean;
  /** Binding direction from `@bindable` JSDoc. */
  binding?: ComponentPropBinding;
  /** True when declared with Svelte 5 `$bindable()`. */
  bindable?: true;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** `@since` / `@example` tags in source order. */
  tags?: JsDocPassthroughTag[];
  /** Source range when available. */
  source?: SourceRange;
}

const DEFAULT_SLOT_NAME = null;

/** Matches `@component` in HTML comments. */
const COMPONENT_COMMENT_REGEX = /^@component/;

const CARRIAGE_RETURN_REGEX = /\r/g;

/** Matches a JSDoc `@slot`/`@snippet` type of an empty object literal, e.g. `{{}}` or `{{ }}`. */
const EMPTY_OBJECT_TYPE_REGEX = /^\{\s*\}$/;

const _NEWLINE_CR_REGEX = /[\r\n]+/g;

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
  props: ComponentProp[];
  /** Exports from `<script context="module">`. */
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
  /**
   * Type guesses from this parse (unknown props, `any` contexts, orphan `@event` tags).
   */
  diagnostics?: SveldDiagnostic[];
  /** Writer-only TypeScript metadata. Not serialized to JSON. */
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
    return assignValueOrUndefined(value);
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

  private buildVariableInfoCache() {
    if (!this.ctx.source) return;

    if (!this.ctx.sourceLinesCache) {
      this.ctx.sourceLinesCache = this.ctx.source.split("\n");
    }
    const lines = this.ctx.sourceLinesCache;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const varMatch = line.match(VAR_DECLARATION_REGEX);
      if (varMatch) {
        const varName = varMatch[1];

        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j].trim();

          if (prevLine && !prevLine.startsWith("*") && !prevLine.startsWith("/*") && !prevLine.startsWith("//")) {
            break;
          }

          if (prevLine.startsWith("/**")) {
            const commentLines: string[] = [];
            for (let k = j; k < i; k++) {
              commentLines.push(lines[k]);
            }
            const commentBlock = commentLines.join("\n");

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

  private static readonly VAR_NAME_REGEX_CACHE = new Map<string, [RegExp, RegExp, RegExp]>();

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

    if (!this.ctx.source) return null;

    if (!this.ctx.sourceLinesCache) {
      this.ctx.sourceLinesCache = this.ctx.source.split("\n");
    }
    const lines = this.ctx.sourceLinesCache;

    const [constRegex, letRegex, funcRegex] = ComponentParser.getVarNameRegexes(varName);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const constMatch = line.match(constRegex);
      const letMatch = line.match(letRegex);
      const funcMatch = line.match(funcRegex);

      if (constMatch || letMatch || funcMatch) {
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j].trim();

          if (prevLine && !prevLine.startsWith("*") && !prevLine.startsWith("/*") && !prevLine.startsWith("//")) {
            break;
          }

          if (prevLine.startsWith("/**")) {
            const commentLines: string[] = [];
            for (let k = j; k < i; k++) {
              commentLines.push(lines[k]);
            }
            const commentBlock = commentLines.join("\n");

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
    buildRunesPropTypeMetadata(this, this.ctx);

    /**
     * Parse once - compile()'s analyze phase roughly doubles the compiler cost per component but
     * sveld only ever consumed its AST and its runes-metadata flag, so call parse() directly and
     * determine the syntax mode locally instead.
     */
    this.ctx.parsed = parse(cleanedSource, { modern: false }) as LegacyAstRoot;

    /**
     * compile() strips TS-only wrapper expressions (`as`/`satisfies`/`!`/type assertions/explicit
     * generic instantiation) before exposing its AST; parse() alone leaves them in place. Only
     * TS-tagged scripts can contain them, so skip the walk entirely for plain JS components.
     */
    if (this.ctx.scriptLanguage === "ts") {
      stripTypeCastWrappers(this.ctx.parsed.module);
      stripTypeCastWrappers(this.ctx.parsed.instance);
      stripTypeCastWrappers(this.ctx.parsed.html);
    }

    this.ctx.syntaxMode = detectSyntaxMode(this.ctx);

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
            if (node.declaration == null) {
              return;
            }

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
        // Fuse scope declaration into this walk (see enterNestedScopeDeclarationNode).
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

        // Svelte Spread nodes: `{...$$restProps}` and rest-prop locals.
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
          if (node.declaration == null && node.specifiers.length === 0) {
            return;
          }

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
            // Walk is in order; the local binding must appear before this export.
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

          if (node.declaration == null) {
            return;
          }

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

        if (node && typeof node === "object" && "type" in node && String(node.type) === "Comment") {
          const commentNode = node as { data?: string };
          const data: string = commentNode?.data?.trim() ?? "";

          if (COMPONENT_COMMENT_REGEX.test(data)) {
            this.ctx.componentComment = data.replace(COMPONENT_COMMENT_REGEX, "").replace(CARRIAGE_RETURN_REGEX, "");
            this.ctx.componentCommentSource = sourceRangeFromNode(this.ctx, node);
          }
        }

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

        // Bare `on:event` handlers forward events; dispatched events win and are reconciled after the walk.
        if (node && typeof node === "object" && "type" in node && String(node.type) === "EventHandler") {
          const eventHandlerNode = node as { expression?: unknown; name?: string };
          if (eventHandlerNode.expression == null && eventHandlerNode.name) {
            if (parent != null && typeof parent === "object" && "name" in parent) {
              const parentName = typeof parent.name === "string" ? parent.name : undefined;
              const parentType = "type" in parent ? String(parent.type) : undefined;
              if (parentName && parentType) {
                const element: ComponentInlineElement | ComponentElement =
                  parentType === "InlineComponent"
                    ? { type: "InlineComponent", name: parentName }
                    : { type: "Element", name: parentName };

                this.ctx.forwardedEvents.set(eventHandlerNode.name, element);

                const existing_event = this.ctx.events.get(eventHandlerNode.name);

                const event_description = this.ctx.eventDescriptions.get(eventHandlerNode.name);
                const event_deprecated = existing_event?.deprecated;

                if (!existing_event) {
                  this.ctx.events.set(eventHandlerNode.name, {
                    type: "forwarded",
                    name: eventHandlerNode.name,
                    element: element,
                    description: event_description,
                    deprecated: event_deprecated,
                    source: sourceRangeFromNode(this.ctx, node),
                  });
                } else if (existing_event.type === "forwarded" && event_description && !existing_event.description) {
                  this.ctx.events.set(eventHandlerNode.name, {
                    ...existing_event,
                    description: event_description,
                    deprecated: existing_event.deprecated ?? event_deprecated,
                    source: existing_event.source || sourceRangeFromNode(this.ctx, node),
                  });
                }
              }
            }
          }
        }

        /**
         * Legacy `bind:*` marks props reactive; `bind:this` on elements also narrows the prop type.
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
        // JSDoc `@slot`/`@snippet` tags are already TS type text; template parsing yields a SlotProps map.
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

        // Force multiline when count > 1 (matches interface body formatting).
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
