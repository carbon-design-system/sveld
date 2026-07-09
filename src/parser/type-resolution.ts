import type {
  ComponentGenerics,
  LocalTypeDeclaration,
  ModernRunesTypeNode,
  ParsedComponentTypeScriptMetadata,
} from "../ComponentParser";
import type { ParserContext } from "./context";
import { sourceAtPos } from "./source-position";

const GENERIC_TYPE_TEXT_IDENTIFIER_REGEX = /[A-Za-z_$][\w$]*/g;

/**
 * Whether `typeText` (e.g. a canonical `$props()` type like `Props<T>`)
 * mentions one of `generics`' own parameter names as a bare identifier.
 * Used to detect whole-props types parameterized by the component's own
 * generic, which the semantic type resolver can't safely expand: it has no
 * binding for the generic in its virtual module, so TypeScript treats it as
 * an unresolved identifier and fabricates concrete-looking types instead.
 */
function typeTextReferencesGenerics(typeText: string, generics: ComponentGenerics): boolean {
  if (!generics) return false;
  const names = new Set(generics[0].split(",").map((name) => name.trim()));
  for (const [name] of typeText.matchAll(GENERIC_TYPE_TEXT_IDENTIFIER_REGEX)) {
    if (names.has(name)) return true;
  }
  return false;
}

export function getRunesPropsDeclarationMetadata(ctx: ParserContext, declaratorStart: number | undefined) {
  if (declaratorStart === undefined) return undefined;
  return ctx.runesPropsDeclarationMetadataByDeclaratorStart.get(declaratorStart);
}

export function getRunesPropTypeMetadata(ctx: ParserContext, declaratorStart: number | undefined, propName: string) {
  return getRunesPropsDeclarationMetadata(ctx, declaratorStart)?.props.get(propName);
}

export function getTypeReferenceName(typeName: unknown): string | undefined {
  if (!typeName || typeof typeName !== "object" || !("type" in typeName)) return undefined;

  if (typeName.type === "Identifier" && "name" in typeName && typeof typeName.name === "string") {
    return typeName.name;
  }

  if (
    typeName.type === "TSQualifiedName" &&
    "right" in typeName &&
    typeName.right &&
    typeof typeName.right === "object" &&
    "name" in typeName.right &&
    typeof typeName.right.name === "string"
  ) {
    return typeName.right.name;
  }

  return undefined;
}

export function getTypeDependencyName(typeName: unknown): string | undefined {
  if (!typeName || typeof typeName !== "object" || !("type" in typeName)) return undefined;

  if (typeName.type === "Identifier" && "name" in typeName && typeof typeName.name === "string") {
    return typeName.name;
  }

  if (typeName.type === "TSQualifiedName" && "left" in typeName && typeName.left && typeof typeName.left === "object") {
    return getTypeDependencyName(typeName.left);
  }

  return undefined;
}

export function getTypeAnnotationText(
  ctx: ParserContext,
  typeAnnotation: { start?: number; end?: number } | undefined,
) {
  const start = typeAnnotation?.start;
  const end = typeAnnotation?.end;
  if (start === undefined || end === undefined) return undefined;
  return sourceAtPos(ctx, start + 1, end)?.trim();
}

export function getTypeNodeText(ctx: ParserContext, typeNode: { start?: number; end?: number } | undefined) {
  const start = typeNode?.start;
  const end = typeNode?.end;
  if (start === undefined || end === undefined) return undefined;
  return sourceAtPos(ctx, start, end)?.trim();
}

export function collectReferencedTypeDependencies(
  ctx: ParserContext,
  typeNode: ModernRunesTypeNode | undefined,
  referencedImportedTypes: Set<string>,
  referencedLocalTypes: Set<string>,
  visitedLocalTypes: Set<string> = new Set(),
) {
  if (!typeNode?.type) return;

  switch (typeNode.type) {
    case "TSInterfaceDeclaration":
      collectReferencedTypeDependencies(
        ctx,
        { type: "TSTypeLiteral", members: typeNode.body?.body },
        referencedImportedTypes,
        referencedLocalTypes,
        visitedLocalTypes,
      );
      return;
    case "TSTypeAliasDeclaration":
    case "TSParenthesizedType":
    case "TSTypeAnnotation":
      collectReferencedTypeDependencies(
        ctx,
        typeNode.typeAnnotation,
        referencedImportedTypes,
        referencedLocalTypes,
        visitedLocalTypes,
      );
      return;
    case "TSIntersectionType":
    case "TSUnionType":
      for (const nestedType of typeNode.types ?? []) {
        collectReferencedTypeDependencies(
          ctx,
          nestedType,
          referencedImportedTypes,
          referencedLocalTypes,
          visitedLocalTypes,
        );
      }
      return;
    case "TSTypeLiteral":
      for (const member of typeNode.members ?? []) {
        if (member?.type !== "TSPropertySignature") continue;
        collectReferencedTypeDependencies(
          ctx,
          member.typeAnnotation?.typeAnnotation,
          referencedImportedTypes,
          referencedLocalTypes,
          visitedLocalTypes,
        );
      }
      return;
    case "TSTypeReference": {
      const dependencyName = getTypeDependencyName(typeNode.typeName);
      if (dependencyName) {
        if (ctx.typeImportBindingsByLocalName.has(dependencyName)) {
          referencedImportedTypes.add(dependencyName);
        }

        const localDeclaration = ctx.localTypeDeclarationsByName.get(dependencyName);
        if (localDeclaration && !visitedLocalTypes.has(dependencyName)) {
          referencedLocalTypes.add(dependencyName);
          visitedLocalTypes.add(dependencyName);
          collectReferencedTypeDependencies(
            ctx,
            localDeclaration.node,
            referencedImportedTypes,
            referencedLocalTypes,
            visitedLocalTypes,
          );
          visitedLocalTypes.delete(dependencyName);
        }
      }

      if ("typeParameters" in typeNode && typeNode.typeParameters && typeof typeNode.typeParameters === "object") {
        const paramsNode = typeNode.typeParameters as { params?: ModernRunesTypeNode[] };
        for (const param of paramsNode.params ?? []) {
          collectReferencedTypeDependencies(
            ctx,
            param,
            referencedImportedTypes,
            referencedLocalTypes,
            visitedLocalTypes,
          );
        }
      }
      return;
    }
    case "TSArrayType":
    case "TSRestType":
    case "TSOptionalType":
    case "TSIndexedAccessType":
    case "TSTypeOperator":
    case "TSExpressionWithTypeArguments":
    case "TSTupleType":
    case "TSConditionalType":
    case "TSInferType":
    case "TSMappedType":
    case "TSFunctionType":
    case "TSConstructorType":
    case "TSTypeQuery":
    case "TSImportType":
    case "TSLiteralType":
    case "TSTypePredicate":
    case "TSNamedTupleMember":
      break;
    default:
      break;
  }

  for (const value of Object.values(typeNode)) {
    if (!value || typeof value !== "object") continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item || typeof item !== "object" || !("type" in item)) continue;
        collectReferencedTypeDependencies(
          ctx,
          item as ModernRunesTypeNode,
          referencedImportedTypes,
          referencedLocalTypes,
          visitedLocalTypes,
        );
      }
      continue;
    }

    if ("type" in value) {
      collectReferencedTypeDependencies(
        ctx,
        value as ModernRunesTypeNode,
        referencedImportedTypes,
        referencedLocalTypes,
        visitedLocalTypes,
      );
    }
  }
}

export function buildTypeImportStatements(ctx: ParserContext, referencedImportedTypes: Set<string>) {
  const groupedImports = new Map<
    string,
    { default: string[]; named: Array<{ imported?: string; local: string }>; namespace: string[] }
  >();

  for (const importedType of Array.from(referencedImportedTypes).sort()) {
    const binding = ctx.typeImportBindingsByLocalName.get(importedType);
    if (!binding) continue;

    const group = groupedImports.get(binding.source) ?? { default: [], named: [], namespace: [] };

    if (binding.specifierType === "default") {
      group.default.push(binding.localName);
    } else if (binding.specifierType === "namespace") {
      group.namespace.push(binding.localName);
    } else {
      group.named.push({
        imported: binding.importedName,
        local: binding.localName,
      });
    }

    groupedImports.set(binding.source, group);
  }

  return Array.from(groupedImports.entries())
    .sort(([sourceA], [sourceB]) => sourceA.localeCompare(sourceB))
    .map(([source, group]) => {
      if (group.namespace.length > 0) {
        return group.namespace.map((localName) => `import type * as ${localName} from "${source}";`).join("\n");
      }

      const namedParts = group.named.map(({ imported, local }) => {
        if (!imported || imported === local) return local;
        return `${imported} as ${local}`;
      });
      const defaultImport = group.default[0];
      const namedImport = namedParts.length > 0 ? `{ ${namedParts.join(", ")} }` : "";

      if (defaultImport && namedImport) {
        return `import type ${defaultImport}, ${namedImport} from "${source}";`;
      }
      if (defaultImport) {
        return `import type ${defaultImport} from "${source}";`;
      }
      return `import type ${namedImport} from "${source}";`;
    });
}

export function buildTypeScriptMetadata(ctx: ParserContext): ParsedComponentTypeScriptMetadata | undefined {
  if (ctx.typedRunesPropsDeclarations.length !== 1) return undefined;

  const [typedDeclaration] = ctx.typedRunesPropsDeclarations;
  if (!typedDeclaration.canonicalType) return undefined;

  const localTypeDeclarations = Array.from(typedDeclaration.referencedLocalTypes)
    .map((typeName) => ctx.localTypeDeclarationsByName.get(typeName))
    .filter((declaration): declaration is LocalTypeDeclaration => declaration !== undefined)
    .sort((a, b) => a.start - b.start)
    .map((declaration) => declaration.code);

  return {
    canonicalPropsType: typedDeclaration.canonicalType,
    canonicalPropNames: Array.from(typedDeclaration.props.keys()).sort(),
    localTypeDeclarations,
    typeImportStatements: buildTypeImportStatements(ctx, typedDeclaration.referencedImportedTypes),
    referencesComponentGenerics: typeTextReferencesGenerics(typedDeclaration.canonicalType, ctx.generics),
  };
}
