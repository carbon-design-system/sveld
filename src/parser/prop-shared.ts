import type { ComponentPropParam, ComponentPropTypeSource } from "../ComponentParser";

/**
 * Decides a prop's provenance for docs UIs. Order is fixed and mirrors the
 * precedence used to pick the prop's final `type` text in
 * {@link resolvePropTypeAndDocs}: an explicit TypeScript annotation always
 * wins, then JSDoc `@type`/`@param`/`@returns`, then a type resolved from an
 * identifier default's own JSDoc, and only then a bare inferred/initializer
 * type. `"unknown"` means none of the above produced any type text at all.
 */
export function resolveTypeSource({
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

export interface ResolvePropTypeAndDocsInput {
  /** Explicit TypeScript type text: a legacy `: T` annotation, or the matching `$props()` type-literal member in runes. */
  explicitType?: string;
  /**
   * Lowest-precedence type text, used only when nothing else applies: the
   * initializer's inferred type, or the literal `"() => any"` seed for a
   * bare `export function` declaration (which has no initializer).
   */
  typeSeed?: string;
  /**
   * Value fed to {@link resolveTypeSource}'s `inferredType` bucket. Distinct
   * from `typeSeed` for function declarations, which have an initializer-less
   * `typeSeed` placeholder but no actual inferred type.
   */
  inferredTypeForSource?: string;
  jsdocType?: string;
  jsdocDescription?: string;
  jsdocParams?: ComponentPropParam[];
  jsdocReturnType?: string;
  /**
   * Type/description/params/returnType resolved from an identifier default's
   * own JSDoc (e.g. `export let onClick = defaultHandler;` where
   * `defaultHandler` carries its own doc comment). Callers should gate this
   * to `undefined` whenever `explicitType`/`jsdocType` is already set, so it
   * only ever fills a genuine gap (see {@link resolvePropIsFunction}, which
   * relies on the same gating).
   */
  resolvedType?: string;
  resolvedDescription?: string;
  resolvedParams?: ComponentPropParam[];
  resolvedReturnType?: string;
  /** True when the initializer itself is an arrow/function expression. */
  initializerIsFunction: boolean;
  /** True for a bare `export function foo() {}` declaration. */
  isFunctionDeclaration: boolean;
  /**
   * Runes-only: also treat the prop as a function when its resolved type
   * text looks like a callback signature (`@param`/`@returns`/`=>` from
   * TypeScript, JSDoc, or an identifier default). Legacy `export let` never
   * applies this signature check; the mode difference predates this helper
   * and is preserved here rather than silently converged.
   */
  inferIsFunctionFromTypeSignature?: boolean;
  /**
   * Legacy-only: fall back to a `@typedef`'s own description when the prop
   * has none of its own. Runes omits this today (a preserved mode
   * difference); pass `undefined` there.
   */
  typedefs?: Map<string, { description?: string }>;
}

export interface ResolvedPropTypeAndDocs {
  type?: string;
  typeSource: ComponentPropTypeSource;
  description?: string;
  params?: ComponentPropParam[];
  returnType?: string;
  isFunction: boolean;
}

/**
 * Resolves the type/description/params/returnType/isFunction decisions
 * shared by every prop front-end (legacy module exports, legacy instance
 * `export let`/`export function`, and runes `$props()` destructuring). The
 * front-ends differ only in how they extract the raw signals below from
 * their respective AST shapes; once extracted, the decisions are identical
 * except where explicitly parameterized above.
 */
export function resolvePropTypeAndDocs(input: ResolvePropTypeAndDocsInput): ResolvedPropTypeAndDocs {
  let type = input.explicitType ?? input.jsdocType ?? input.resolvedType ?? input.typeSeed;
  const params = input.jsdocParams ?? input.resolvedParams;
  const returnType = input.jsdocReturnType ?? input.resolvedReturnType;

  // A bare `export function foo() {}` has no `@type` placeholder of its own; if JSDoc
  // supplies `@param`/`@returns` but no `@type`, build a signature from them.
  if (input.isFunctionDeclaration && type === "() => any" && returnType) {
    type =
      params && params.length > 0
        ? `(${params.map((param) => `${param.name}${param.optional ? "?" : ""}: ${param.type}`).join(", ")}) => ${returnType}`
        : `() => ${returnType}`;
  }

  let description = input.jsdocDescription ?? input.resolvedDescription;
  if (description === undefined && type !== undefined) {
    description = input.typedefs?.get(type)?.description;
  }

  const typeSource = resolveTypeSource({
    hasTypeScriptType: input.explicitType !== undefined,
    hasJSDocType:
      input.jsdocType !== undefined ||
      input.jsdocParams !== undefined ||
      input.jsdocReturnType !== undefined ||
      input.resolvedType !== undefined,
    inferredType: input.inferredTypeForSource,
    finalType: type,
  });

  const isFunction =
    input.initializerIsFunction ||
    input.isFunctionDeclaration ||
    (input.inferIsFunctionFromTypeSignature === true &&
      (!!input.jsdocParams?.length ||
        input.jsdocReturnType !== undefined ||
        !!input.jsdocType?.includes("=>") ||
        !!input.resolvedType?.includes("=>") ||
        !!input.explicitType?.includes("=>")));

  return { type, typeSource, description, params, returnType, isFunction };
}
