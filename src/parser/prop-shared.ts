import type { ComponentPropParam, ComponentPropTypeSource } from "../model";
import { formatParamList } from "./utils";

/** A prop's type provenance, in the same precedence {@link resolvePropTypeAndDocs} picks its type. */
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
  /** A legacy `: T` annotation, or the matching `$props()` type-literal member. */
  explicitType?: string;
  /** Lowest precedence: the initializer's inferred type, or `"() => any"` for an `export function`. */
  typeSeed?: string;
  /** Differs from `typeSeed` for function declarations, whose seed is a placeholder, not an inferred type. */
  inferredTypeForSource?: string;
  jsdocType?: string;
  jsdocDescription?: string;
  jsdocParams?: ComponentPropParam[];
  jsdocReturnType?: string;
  jsdocTypeParameters?: string;
  /**
   * From an identifier default's own JSDoc (`export let onClick = handler`).
   * Callers leave it unset when `explicitType`/`jsdocType` is set.
   */
  resolvedType?: string;
  resolvedDescription?: string;
  resolvedParams?: ComponentPropParam[];
  resolvedReturnType?: string;
  initializerIsFunction: boolean;
  isFunctionDeclaration: boolean;
  /** Runes-only (a preserved mode difference): a callback-looking type makes the prop a function. */
  inferIsFunctionFromTypeSignature?: boolean;
  /** Legacy-only (a preserved mode difference): falls back to a `@typedef`'s description. */
  typedefs?: Map<string, { description?: string }>;
}

export interface ResolvedPropTypeAndDocs {
  type?: string;
  typeSource: ComponentPropTypeSource;
  description?: string;
  params?: ComponentPropParam[];
  returnType?: string;
  isFunction: boolean;
  typeParameters?: string;
}

/** The type and docs decisions shared by module exports, `export let`/`export function`, and `$props()`. */
export function resolvePropTypeAndDocs(input: ResolvePropTypeAndDocsInput): ResolvedPropTypeAndDocs {
  let type = input.explicitType ?? input.jsdocType ?? input.resolvedType ?? input.typeSeed;
  const params = input.jsdocParams ?? input.resolvedParams;
  const returnType = input.jsdocReturnType ?? input.resolvedReturnType;

  // A function's placeholder signature gives way to one built from `@param`/`@returns`.
  const hasPlaceholderSignature = input.isFunctionDeclaration
    ? type === "() => any"
    : input.initializerIsFunction && type === input.typeSeed;
  if (hasPlaceholderSignature && returnType) {
    const typeParameters = input.jsdocTypeParameters ? `<${input.jsdocTypeParameters}>` : "";
    type = `${typeParameters}(${formatParamList(params ?? [])}) => ${returnType}`;
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

  const typeParameters = isFunction ? input.jsdocTypeParameters : undefined;

  return { type, typeSource, description, params, returnType, isFunction, typeParameters };
}
