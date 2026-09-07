import type {
  ComponentGenerics,
  LocalTypeDeclaration,
  ModernRunesTypeNode,
  ParsedComponentTypeScriptMetadata,
  TypeImportBinding,
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

function getTypeDependencyName(typeName: unknown): string | undefined {
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
        // A value import used only in a type position (e.g. `import { Size } from` a sibling
        // module, with no `type` modifier) still needs an `import type` line in the standalone
        // `.d.ts`; the runtime import in the component's own script is untouched.
        if (
          ctx.typeImportBindingsByLocalName.has(dependencyName) ||
          ctx.valueImportBindingsByLocalName.has(dependencyName)
        ) {
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

function buildTypeImportStatements(ctx: ParserContext, referencedImportedTypes: Set<string>) {
  const groupedImports = new Map<
    string,
    { default: string[]; named: Array<{ imported?: string; local: string }>; namespace: string[] }
  >();

  for (const importedType of Array.from(referencedImportedTypes).sort()) {
    const typeBinding = ctx.typeImportBindingsByLocalName.get(importedType);
    const valueBinding = typeBinding ? undefined : ctx.valueImportBindingsByLocalName.get(importedType);
    const binding: TypeImportBinding | undefined =
      typeBinding ??
      (valueBinding
        ? {
            importedName: valueBinding.importedName,
            localName: valueBinding.localName,
            source: valueBinding.source,
            specifierType: "named",
          }
        : undefined);
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

/**
 * Records a type node found outside the whole-object `$props()` path (legacy
 * annotations, runes per-prop annotations, accessor signatures) so
 * {@link buildTypeScriptMetadata} pulls its imported/local dependencies into
 * the `.d.ts`, same as the whole-object case already does.
 */
export function trackAdditionalTypeDependencyNode(ctx: ParserContext, typeNode: ModernRunesTypeNode | undefined) {
  if (typeNode) ctx.additionalTypeDependencyNodes.push(typeNode);
}

/** The subset of a `TSEnumDeclaration`/`TSEnumMember` AST shape this module reads. */
type EnumDeclarationNode = {
  const?: boolean;
  id?: { name?: string };
  members?: Array<{ initializer?: { type?: string; value?: unknown } }>;
};

/**
 * `const enum` members are inlined at compile time and, unlike interfaces/type
 * aliases, can't be safely re-declared verbatim in a standalone `.d.ts`: many
 * bundlers (esbuild, swc, Vite) reject `const enum` entirely under
 * `isolatedModules`. When every member has a literal initializer, widen it to
 * an equivalent literal union instead; otherwise the caller falls back to the
 * verbatim declaration (best-effort, non-const enums always take that path).
 */
function buildConstEnumUnionTypeCode(enumStatement: EnumDeclarationNode): string | undefined {
  if (!enumStatement.const) return undefined;
  const name = enumStatement.id?.name;
  if (!name) return undefined;

  const literalTexts: string[] = [];
  for (const member of enumStatement.members ?? []) {
    const initializer = member.initializer;
    if (initializer?.type !== "Literal") return undefined;
    const value = initializer.value;
    if (typeof value === "string") literalTexts.push(JSON.stringify(value));
    else if (typeof value === "number") literalTexts.push(String(value));
    else return undefined;
  }
  if (literalTexts.length === 0) return undefined;

  return `type ${name} = ${literalTexts.join(" | ")};`;
}

/** Builds a `LocalTypeDeclaration`-ready `code` string for a top-level `enum`/`const enum`. */
export function buildEnumLocalTypeDeclarationCode(
  ctx: ParserContext,
  enumStatement: EnumDeclarationNode & { start?: number; end?: number },
): string | undefined {
  const unionCode = buildConstEnumUnionTypeCode(enumStatement);
  if (unionCode) return unionCode;

  if (enumStatement.start === undefined || enumStatement.end === undefined) return undefined;
  const verbatim = sourceAtPos(ctx, enumStatement.start, enumStatement.end)?.trim();
  // Unlike `interface`/`type`, a bare top-level `enum` in a module `.d.ts` (one that already has
  // an `import`/`export`) is a TS1046 error: enums emit a runtime value, so TS requires an
  // explicit `declare` (or `export`) modifier the same way it would for a `class`/`function`/`let`.
  return verbatim ? `declare ${verbatim}` : undefined;
}

/** A `FunctionDeclaration` param/return-type AST shape, read for accessor signature text. */
export type FunctionDeclarationLike = {
  params?: Array<{
    type?: string;
    name?: string;
    optional?: boolean;
    typeAnnotation?: { start?: number; end?: number; typeAnnotation?: ModernRunesTypeNode };
    left?: { name?: string; typeAnnotation?: { start?: number; end?: number; typeAnnotation?: ModernRunesTypeNode } };
    argument?: { name?: string };
  }>;
  returnType?: { start?: number; end?: number; typeAnnotation?: ModernRunesTypeNode };
};

/**
 * Builds a `(params) => ReturnType` signature string from a `FunctionDeclaration`'s
 * own TS annotations (params, defaults, rest, return type), for `export function`
 * accessors in `lang="ts"` components. Untyped positions fall back to `any` rather
 * than being dropped. Returns `hasAnnotations: false` when nothing was actually
 * annotated, so the caller can prefer a JSDoc-derived signature instead.
 */
export function buildFunctionDeclarationSignature(
  ctx: ParserContext,
  funcDecl: FunctionDeclarationLike,
): { signature: string; hasAnnotations: boolean } {
  let hasAnnotations = false;
  const paramTexts: string[] = [];

  for (const param of funcDecl.params ?? []) {
    if (param.type === "RestElement") {
      const name = param.argument?.name ?? "rest";
      const typeText = getTypeAnnotationText(ctx, param.typeAnnotation);
      if (typeText) hasAnnotations = true;
      trackAdditionalTypeDependencyNode(ctx, param.typeAnnotation?.typeAnnotation);
      paramTexts.push(`...${name}: ${typeText ?? "any[]"}`);
      continue;
    }

    const hasDefault = param.type === "AssignmentPattern";
    const target = hasDefault ? param.left : param;
    const name = target?.name ?? "arg";
    const typeText = getTypeAnnotationText(ctx, target?.typeAnnotation);
    if (typeText) hasAnnotations = true;
    trackAdditionalTypeDependencyNode(ctx, target?.typeAnnotation?.typeAnnotation);
    const optional = hasDefault || param.optional === true;
    paramTexts.push(`${name}${optional ? "?" : ""}: ${typeText ?? "any"}`);
  }

  const returnTypeText = getTypeAnnotationText(ctx, funcDecl.returnType);
  if (returnTypeText) hasAnnotations = true;
  trackAdditionalTypeDependencyNode(ctx, funcDecl.returnType?.typeAnnotation);

  return { signature: `(${paramTexts.join(", ")}) => ${returnTypeText ?? "any"}`, hasAnnotations };
}

export function buildTypeScriptMetadata(ctx: ParserContext): ParsedComponentTypeScriptMetadata | undefined {
  const pendingCallDefaultCandidates =
    ctx.pendingCallDefaultCandidates.length > 0 ? ctx.pendingCallDefaultCandidates.slice() : undefined;
  const pendingContextKeyCandidates =
    ctx.pendingContextKeyCandidates.length > 0 ? ctx.pendingContextKeyCandidates.slice() : undefined;
  const pendingCrossFileCandidates = {
    ...(pendingCallDefaultCandidates ? { pendingCallDefaultCandidates } : {}),
    ...(pendingContextKeyCandidates ? { pendingContextKeyCandidates } : {}),
  };
  const hasPendingCrossFileCandidates =
    pendingCallDefaultCandidates !== undefined || pendingContextKeyCandidates !== undefined;

  const referencedImportedTypes = new Set<string>();
  const referencedLocalTypes = new Set<string>();
  for (const typeNode of ctx.additionalTypeDependencyNodes) {
    collectReferencedTypeDependencies(ctx, typeNode, referencedImportedTypes, referencedLocalTypes);
  }

  const typedDeclaration =
    ctx.typedRunesPropsDeclarations.length === 1 ? ctx.typedRunesPropsDeclarations[0] : undefined;
  const canonicalType = typedDeclaration?.canonicalType;
  if (typedDeclaration && canonicalType) {
    for (const name of typedDeclaration.referencedImportedTypes) referencedImportedTypes.add(name);
    for (const name of typedDeclaration.referencedLocalTypes) referencedLocalTypes.add(name);
  }

  if (!canonicalType && referencedImportedTypes.size === 0 && referencedLocalTypes.size === 0) {
    return hasPendingCrossFileCandidates
      ? { canonicalPropNames: [], localTypeDeclarations: [], typeImportStatements: [], ...pendingCrossFileCandidates }
      : undefined;
  }

  const localTypeDeclarations = Array.from(referencedLocalTypes)
    .map((typeName) => ctx.localTypeDeclarationsByName.get(typeName))
    .filter((declaration): declaration is LocalTypeDeclaration => declaration !== undefined)
    .sort((a, b) => a.start - b.start)
    .map((declaration) => declaration.code);

  return {
    ...(canonicalType ? { canonicalPropsType: canonicalType } : {}),
    canonicalPropNames: typedDeclaration && canonicalType ? Array.from(typedDeclaration.props.keys()).sort() : [],
    localTypeDeclarations,
    typeImportStatements: buildTypeImportStatements(ctx, referencedImportedTypes),
    referencesComponentGenerics: canonicalType ? typeTextReferencesGenerics(canonicalType, ctx.generics) : false,
    ...pendingCrossFileCandidates,
  };
}
