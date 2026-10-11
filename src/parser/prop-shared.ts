import type { ComponentPropParam, ComponentPropTypeSource, NodeJsDoc } from "../model";
import { isFunctionType } from "../type-text";
import type { ParserContext } from "./context";
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
  /** Lowest precedence: the type inferred from the initializer or `export function` node. */
  typeSeed?: string;
  /** Differs from `typeSeed` for function declarations, whose seed doesn't count as an inferred type. */
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
  /** A prop typed as a `@typedef` with no description of its own takes the typedef's. */
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

  // A function's inferred signature gives way to one built from `@param`/`@returns`.
  const hasPlaceholderSignature =
    (input.isFunctionDeclaration || input.initializerIsFunction) && type === input.typeSeed;
  if (hasPlaceholderSignature && (returnType || (input.isFunctionDeclaration && params?.length))) {
    const typeParameters = input.jsdocTypeParameters ? `<${input.jsdocTypeParameters}>` : "";
    type = `${typeParameters}(${formatParamList(params ?? [])}) => ${returnType ?? "any"}`;
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

  // A callback-looking declared type makes the prop a function too.
  const isFunction =
    input.initializerIsFunction ||
    input.isFunctionDeclaration ||
    !!input.jsdocParams?.length ||
    input.jsdocReturnType !== undefined ||
    isFunctionType(input.jsdocType) ||
    isFunctionType(input.resolvedType) ||
    isFunctionType(input.explicitType);

  const typeParameters = isFunction ? input.jsdocTypeParameters : undefined;

  return { type, typeSource, description, params, returnType, isFunction, typeParameters };
}

/**
 * A prop's own JSDoc with an explicit `@default` taken out of its description: the prop
 * shows it as its default (`value`) instead, and no other file's constant replaces it.
 */
export function withExplicitDefault(ctx: ParserContext, propName: string, jsdoc: NodeJsDoc | undefined) {
  if (jsdoc?.explicitDefault === undefined) return jsdoc;
  ctx.explicitDefaultPropNames.add(propName);
  return { ...jsdoc, description: jsdoc.descriptionWithoutDefault };
}

/** The fields a prop copies verbatim from its own JSDoc block, in prop key order. */
export function propJsDocFields(jsdoc: NodeJsDoc | undefined) {
  return {
    binding: jsdoc?.binding,
    deprecated: jsdoc?.deprecated,
    tags: jsdoc?.tags,
    ...(jsdoc?.internal ? { internal: true as const } : {}),
  };
}
