import type { AssignmentPattern, Identifier, Property, VariableDeclaration, VariableDeclarator } from "estree";
import { parse } from "svelte/compiler";
import { getTypeCastAnnotation, isCallExpressionNamed, unwrapTypeCastExpression } from "../ast-guards";
import type ComponentParser from "../ComponentParser";
import type {
  ModernRunesTypeMember,
  ModernRunesTypeNode,
  ModernScriptNode,
  RunesPropsDeclarationMetadata,
  RunesPropTypeMetadata,
  TypeImportBinding,
} from "../ComponentParser";
import type { ParserContext } from "./context";
import { collectGenericsAttributeTypeDependencies } from "./generics";
import { processLeadingCommentsJSDoc, processNodeJSDoc } from "./jsdoc";
import { addProp, processInitializer, unwrapBindableInitializer } from "./props";
import { sourceAtPos, sourceRangeFromNode } from "./source-position";
import {
  collectReferencedTypeDependencies,
  getRunesPropsDeclarationMetadata,
  getRunesPropTypeMetadata,
  getTypeAnnotationText,
  getTypeNodeText,
  getTypeReferenceName,
} from "./type-resolution";

/** Any identifier-shaped token, used to substitute type-parameter names within a type's source text. */
const IDENTIFIER_TOKEN_REGEX = /[A-Za-z_$][\w$]*/g;

/**
 * Maps a referenced interface/type-alias's own type-parameter names (`Props<T>`) to the
 * concrete type-argument source text supplied at the reference site (`Props<string>`).
 */
function buildTypeParameterSubstitutions(
  ctx: ParserContext,
  declaration: ModernRunesTypeNode,
  reference: ModernRunesTypeNode,
): Map<string, string> {
  const substitutions = new Map<string, string>();
  const typeParams = declaration.typeParameters?.params;
  const typeArgs = reference.typeArguments?.params;
  if (!typeParams?.length || !typeArgs?.length) return substitutions;

  for (let index = 0; index < typeParams.length; index++) {
    const paramName = typeParams[index]?.name;
    const argNode = typeArgs[index];
    if (!paramName || argNode?.start === undefined || argNode?.end === undefined) continue;

    const argText = sourceAtPos(ctx, argNode.start, argNode.end)?.trim();
    if (argText) substitutions.set(paramName, argText);
  }

  return substitutions;
}

/** Replaces bare occurrences of substituted type-parameter names within a type's source text. */
function substituteTypeParameters(type: string, substitutions: Map<string, string>): string {
  if (substitutions.size === 0) return type;
  return type.replace(IDENTIFIER_TOKEN_REGEX, (token) => substitutions.get(token) ?? token);
}

/** Flatten a runes `$props()` type node into prop name -> metadata, following local aliases and intersections. */
export function buildRunesPropTypeMetadataMap(
  parser: ComponentParser,
  ctx: ParserContext,
  typeNode: ModernRunesTypeNode | undefined,
  localTypeDeclarations: Map<string, ModernRunesTypeNode>,
  visitedTypeNames: Set<string> = new Set(),
): Map<string, RunesPropTypeMetadata> {
  const metadata = new Map<string, RunesPropTypeMetadata>();
  if (!typeNode?.type) return metadata;

  const mergeMembers = (members: ModernRunesTypeMember[]) => {
    for (const member of members) {
      if (member?.type !== "TSPropertySignature" || member.computed) continue;
      if (!member.key) continue;

      const propName = parser.getPropertyName(member.key as Property["key"]);
      if (!propName) continue;

      const typeStart = member.typeAnnotation?.start;
      const typeEnd = member.typeAnnotation?.end;
      if (typeStart === undefined || typeEnd === undefined) continue;

      const type = sourceAtPos(ctx, typeStart + 1, typeEnd)?.trim();
      if (!type) continue;

      metadata.set(propName, {
        type,
        optional: member.optional === true,
        source: sourceRangeFromNode(ctx, member),
      });
    }
  };

  switch (typeNode.type) {
    case "TSTypeLiteral":
      mergeMembers(typeNode.members ?? []);
      break;
    case "TSInterfaceDeclaration":
      mergeMembers(typeNode.body?.body ?? []);
      break;
    case "TSTypeAliasDeclaration": {
      const nestedMetadata = buildRunesPropTypeMetadataMap(
        parser,
        ctx,
        typeNode.typeAnnotation,
        localTypeDeclarations,
        visitedTypeNames,
      );
      for (const [propName, memberMetadata] of nestedMetadata) {
        metadata.set(propName, memberMetadata);
      }
      break;
    }
    case "TSTypeReference": {
      const typeName = getTypeReferenceName(typeNode.typeName);
      if (!typeName || visitedTypeNames.has(typeName)) break;

      const declaration = localTypeDeclarations.get(typeName);
      if (!declaration) break;

      visitedTypeNames.add(typeName);
      const nestedMetadata = buildRunesPropTypeMetadataMap(
        parser,
        ctx,
        declaration,
        localTypeDeclarations,
        visitedTypeNames,
      );
      visitedTypeNames.delete(typeName);

      const substitutions = buildTypeParameterSubstitutions(ctx, declaration, typeNode);
      for (const [propName, memberMetadata] of nestedMetadata) {
        metadata.set(
          propName,
          substitutions.size === 0
            ? memberMetadata
            : { ...memberMetadata, type: substituteTypeParameters(memberMetadata.type, substitutions) },
        );
      }
      break;
    }
    case "TSIntersectionType":
      for (const nestedType of typeNode.types ?? []) {
        const nestedMetadata = buildRunesPropTypeMetadataMap(
          parser,
          ctx,
          nestedType,
          localTypeDeclarations,
          visitedTypeNames,
        );
        for (const [propName, memberMetadata] of nestedMetadata) {
          metadata.set(propName, memberMetadata);
        }
      }
      break;
    case "TSParenthesizedType": {
      const nestedMetadata = buildRunesPropTypeMetadataMap(
        parser,
        ctx,
        typeNode.typeAnnotation,
        localTypeDeclarations,
        visitedTypeNames,
      );
      for (const [propName, memberMetadata] of nestedMetadata) {
        metadata.set(propName, memberMetadata);
      }
      break;
    }
  }

  return metadata;
}

/**
 * Re-parse `ctx.source` in modern AST mode before the legacy walk: type imports,
 * local types, explicit `export let` annotations, and `$props()` metadata.
 */
export function buildRunesPropTypeMetadata(parser: ComponentParser, ctx: ParserContext) {
  ctx.runesPropsDeclarationMetadataByDeclaratorStart.clear();
  ctx.explicitPropTypesByName.clear();
  ctx.typeImportBindingsByLocalName.clear();
  ctx.localTypeDeclarationsByName.clear();
  ctx.typedRunesPropsDeclarations.length = 0;
  if (!ctx.source) return;

  const modernParsed = parse(ctx.source, { modern: true }) as {
    instance?: ModernScriptNode & {
      content?: {
        body?: Array<{
          type?: string;
          start?: number;
          end?: number;
          importKind?: string;
          source?: { value?: string };
          specifiers?: Array<{
            type?: string;
            importKind?: string;
            local?: { name?: string };
            imported?: { type?: string; name?: string; value?: string };
          }>;
          id?: { name?: string };
          declaration?: {
            type?: string;
            declarations?: Array<{
              id?: {
                type?: string;
                name?: string;
                typeAnnotation?: {
                  start?: number;
                  end?: number;
                  typeAnnotation?: ModernRunesTypeNode;
                };
              };
            }>;
          };
          declarations?: Array<{
            id?: {
              type?: string;
              name?: string;
              typeAnnotation?: {
                start?: number;
                end?: number;
                typeAnnotation?: ModernRunesTypeNode;
              };
            };
            init?: unknown;
            start?: number;
          }>;
        }>;
      };
    };
    module?: ModernScriptNode;
    options?: { customElement?: { tag?: string } } | null;
  };

  ctx.scriptLanguage = parser.resolveScriptLanguage(modernParsed);
  ctx.customElementTag = modernParsed.options?.customElement?.tag;
  ctx.scriptGenericsAttribute = parser.resolveScriptGenericsAttribute(modernParsed);
  const body = modernParsed.instance?.content?.body ?? [];

  for (const statement of body) {
    if (!statement?.type) continue;
    if (statement.type === "ImportDeclaration" && statement.source?.value) {
      for (const specifier of statement.specifiers ?? []) {
        const localName = specifier.local?.name;
        if (!localName) continue;
        const isTypeOnly = statement.importKind === "type" || specifier.importKind === "type";
        if (!isTypeOnly) continue;

        let specifierType: TypeImportBinding["specifierType"] | undefined;
        let importedName: string | undefined;

        if (specifier.type === "ImportSpecifier") {
          specifierType = "named";
          importedName =
            specifier.imported?.type === "Identifier"
              ? specifier.imported.name
              : typeof specifier.imported?.value === "string"
                ? specifier.imported.value
                : undefined;
        } else if (specifier.type === "ImportDefaultSpecifier") {
          specifierType = "default";
        } else if (specifier.type === "ImportNamespaceSpecifier") {
          specifierType = "namespace";
        }

        if (!specifierType) continue;

        ctx.typeImportBindingsByLocalName.set(localName, {
          importedName,
          localName,
          source: String(statement.source.value),
          specifierType,
        });
      }
    }
    if (
      (statement.type === "TSInterfaceDeclaration" || statement.type === "TSTypeAliasDeclaration") &&
      statement.id?.name &&
      statement.start !== undefined &&
      statement.end !== undefined
    ) {
      ctx.localTypeDeclarationsByName.set(statement.id.name, {
        code: sourceAtPos(ctx, statement.start, statement.end)?.trim() ?? "",
        node: statement as ModernRunesTypeNode,
        start: statement.start,
      });
    }

    if (statement.type === "ExportNamedDeclaration" && statement.declaration?.type === "VariableDeclaration") {
      for (const declarator of statement.declaration.declarations ?? []) {
        if (declarator.id?.type !== "Identifier" || !declarator.id.name) continue;
        const explicitType = getTypeAnnotationText(ctx, declarator.id.typeAnnotation);
        if (explicitType) {
          ctx.explicitPropTypesByName.set(declarator.id.name, explicitType);
        }
      }
    }
  }

  for (const statement of body) {
    if (!statement || typeof statement !== "object" || !("declarations" in statement)) continue;

    for (const declarator of statement.declarations ?? []) {
      if (!isCallExpressionNamed(unwrapTypeCastExpression(declarator.init), "$props")) continue;

      // `let props = $props() as Props` / `... satisfies Props` carry their type on the
      // initializer rather than on `declarator.id`, so fall back to that when there's no
      // explicit `: Props` annotation on the binding itself.
      const castTypeNode = declarator.id?.typeAnnotation
        ? undefined
        : (getTypeCastAnnotation(declarator.init) as ModernRunesTypeNode | undefined);
      const effectiveTypeNode = declarator.id?.typeAnnotation?.typeAnnotation ?? castTypeNode;

      const canonicalType = declarator.id?.typeAnnotation
        ? getTypeAnnotationText(ctx, declarator.id.typeAnnotation)
        : getTypeNodeText(ctx, castTypeNode as { start?: number; end?: number } | undefined);
      const metadata = buildRunesPropTypeMetadataMap(
        parser,
        ctx,
        effectiveTypeNode,
        new Map(
          Array.from(ctx.localTypeDeclarationsByName.entries(), ([name, declaration]) => [name, declaration.node]),
        ),
      );
      const referencedImportedTypes = new Set<string>();
      const referencedLocalTypes = new Set<string>();
      collectReferencedTypeDependencies(ctx, effectiveTypeNode, referencedImportedTypes, referencedLocalTypes);
      collectGenericsAttributeTypeDependencies(ctx, referencedImportedTypes, referencedLocalTypes);

      if (declarator.start !== undefined) {
        const declarationMetadata: RunesPropsDeclarationMetadata = {
          canonicalType,
          props: metadata,
          referencedImportedTypes,
          referencedLocalTypes,
        };
        ctx.runesPropsDeclarationMetadataByDeclaratorStart.set(declarator.start, declarationMetadata);
        if (canonicalType) {
          ctx.typedRunesPropsDeclarations.push(declarationMetadata);
        }
      }
    }
  }
}

/** Top-level `$props()` declarations in runes components. */
export function parseRunesPropsDeclaration(parser: ComponentParser, ctx: ParserContext, node: VariableDeclaration) {
  for (const declarator of node.declarations) {
    if (!isCallExpressionNamed(unwrapTypeCastExpression(declarator.init), "$props")) continue;

    if (declarator.id.type === "Identifier") {
      ctx.wholePropsLocals.add(declarator.id.name);
      ctx.restPropLocals.add(declarator.id.name);

      const metadata = getRunesPropsDeclarationMetadata(
        ctx,
        (declarator as VariableDeclarator & { start?: number }).start,
      );
      if (metadata) {
        for (const [propName, typeMetadata] of metadata.props) {
          addProp(parser, ctx, propName, {
            name: propName,
            kind: "let",
            type: typeMetadata.type,
            typeSource: "typescript",
            isFunction: false,
            isFunctionDeclaration: false,
            isRequired: !typeMetadata.optional,
            constant: false,
            reactive: false,
            source: typeMetadata.source,
          });
        }
      }
      continue;
    }

    if (declarator.id.type !== "ObjectPattern") {
      continue;
    }

    const declarationJSDoc = processNodeJSDoc(ctx, parser, node);

    const supportedPublicPropCount = declarator.id.properties.filter((property) => {
      if (property.type !== "Property" || property.computed) return false;
      const propName = parser.getPropertyName(property.key);
      if (!propName) return false;
      if (property.value.type === "Identifier") return true;
      return property.value.type === "AssignmentPattern" && property.value.left.type === "Identifier";
    }).length;

    for (const property of declarator.id.properties) {
      if (property.type === "RestElement") {
        if (property.argument.type === "Identifier") {
          ctx.restPropLocals.add(property.argument.name);
        }
        continue;
      }

      // Svelte's own `$props()` analysis (VariableDeclarator.js) already rejects computed keys
      // and non-Identifier destructuring targets as a compile error, so neither can reach here.
      const propName = parser.getPropertyName(property.key);
      if (!propName) {
        continue;
      }

      let localName: string | undefined;
      let init: unknown;

      if (property.value.type === "Identifier") {
        localName = property.value.name;
      } else {
        const assignmentPattern = property.value as AssignmentPattern & { left: Identifier };
        localName = assignmentPattern.left.name;
        init = assignmentPattern.right;
      }

      if (!localName) continue;

      parser.trackPropLocalName(propName, localName);
      if (propName === "children") {
        ctx.snippetPropLocals.add(localName);
      }

      const propertyJSDoc =
        processLeadingCommentsJSDoc(ctx, parser, property) ??
        (supportedPublicPropCount === 1 ? declarationJSDoc : undefined);
      const typeMetadata = getRunesPropTypeMetadata(
        ctx,
        (declarator as VariableDeclarator & { start?: number }).start,
        propName,
      );
      const { init: unwrappedInit, bindable } = unwrapBindableInitializer(init);
      const initResult = unwrappedInit == null ? { isFunction: false } : processInitializer(parser, ctx, unwrappedInit);
      const { value, type: inferredType, isFunction, defaultValue } = initResult;
      const inheritedType =
        typeMetadata?.type === undefined && propertyJSDoc?.type === undefined ? initResult.resolvedType : undefined;
      const isFunctionFromJSDoc =
        !!propertyJSDoc?.params?.length ||
        propertyJSDoc?.returnType !== undefined ||
        propertyJSDoc?.type?.includes("=>") ||
        !!inheritedType?.includes("=>") ||
        !!typeMetadata?.type?.includes("=>");
      const type = typeMetadata?.type ?? propertyJSDoc?.type ?? inheritedType ?? inferredType;
      const typeSource = parser.resolveTypeSource({
        hasTypeScriptType: typeMetadata?.type !== undefined,
        hasJSDocType:
          propertyJSDoc?.type !== undefined ||
          propertyJSDoc?.params !== undefined ||
          propertyJSDoc?.returnType !== undefined ||
          inheritedType !== undefined,
        inferredType,
        finalType: type,
      });

      if (bindable) {
        ctx.reactive_vars.add(propName);
      }

      addProp(parser, ctx, propName, {
        name: propName,
        ...(localName === propName ? {} : { localName }),
        kind: "let",
        description: propertyJSDoc?.description ?? initResult.resolvedDescription,
        binding: propertyJSDoc?.binding,
        deprecated: propertyJSDoc?.deprecated,
        tags: propertyJSDoc?.tags,
        ...(bindable ? { bindable: true as const } : {}),
        type,
        typeSource,
        value,
        defaultValue,
        params: propertyJSDoc?.params ?? initResult.resolvedParams,
        returnType: propertyJSDoc?.returnType ?? initResult.resolvedReturnType,
        isFunction: Boolean(isFunction || isFunctionFromJSDoc),
        isFunctionDeclaration: false,
        isRequired: unwrappedInit == null && typeMetadata?.optional !== true,
        constant: false,
        reactive: bindable,
        source: sourceRangeFromNode(ctx, property),
      });
    }
  }
}

/**
 * Runes-only: fold phantom `@event` entries into matching `on<Event>` callback props
 * when nothing in the component actually dispatches that event.
 */
export function normalizeRunesCallbackProps(ctx: ParserContext, actuallyDispatchedEvents: Set<string>) {
  if (ctx.syntaxMode !== "runes") return;

  for (const [eventName, event] of Array.from(ctx.events.entries())) {
    if (event.type !== "dispatched") continue;
    if (actuallyDispatchedEvents.has(eventName) || ctx.forwardedEvents.has(eventName)) continue;

    const callbackPropName = `on${eventName}`;
    const prop = ctx.props.get(callbackPropName);
    if (!prop) continue;

    const hasExplicitPropTyping = prop.type !== undefined || prop.params !== undefined || prop.returnType !== undefined;
    const callbackType =
      event.detail === undefined || event.detail === "undefined" || event.detail === "null"
        ? "() => void"
        : `(detail: ${event.detail}) => void`;

    ctx.props.set(callbackPropName, {
      ...prop,
      description: prop.description ?? event.description,
      type: hasExplicitPropTyping ? prop.type : callbackType,
      typeSource: hasExplicitPropTyping ? prop.typeSource : "inferred",
      isFunction: true,
    });

    ctx.events.delete(eventName);
  }
}
