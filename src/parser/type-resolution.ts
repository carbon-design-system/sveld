import type {
  BaseFunction,
  EntityName,
  TSDeclareMethod,
  TSEnumDeclaration,
  TSNode,
  TypeElement,
  TypeNode,
} from "sveast";
import { SKIP, walk } from "sveast/walk";
import type {
  LocalTypeDeclaration,
  ParsedComponentTypeScriptMetadata,
  PendingCrossFileCandidates,
  TypeImportBinding,
} from "../model";
import type { ParserContext } from "./context";
import { sourceAtPos } from "./source-position";
import { compareText } from "./utils";

export function getRunesPropsDeclarationMetadata(ctx: ParserContext, declaratorStart: number | undefined) {
  if (declaratorStart === undefined) return undefined;
  return ctx.runesPropsDeclarationMetadataByDeclaratorStart.get(declaratorStart);
}

export function getTypeReferenceName(typeName: EntityName): string {
  return typeName.type === "Identifier" ? typeName.name : typeName.right.name;
}

/** The leftmost name, which is what's imported or declared (`ns` in `ns.Type`). */
function getTypeDependencyName(typeName: EntityName): string {
  return typeName.type === "Identifier" ? typeName.name : getTypeDependencyName(typeName.left);
}

function getSpanText(ctx: ParserContext, span: { start?: number; end?: number } | undefined, startOffset: number) {
  const start = span?.start;
  const end = span?.end;
  if (start === undefined || end === undefined) return undefined;
  return sourceAtPos(ctx, start + startOffset, end)?.trim();
}

/** A `TSTypeAnnotation`'s text without its leading colon. */
export function getTypeAnnotationText(
  ctx: ParserContext,
  typeAnnotation: { start?: number; end?: number } | undefined,
) {
  return getSpanText(ctx, typeAnnotation, 1);
}

export function getTypeNodeText(ctx: ParserContext, typeNode: { start?: number; end?: number } | undefined) {
  return getSpanText(ctx, typeNode, 0);
}

export function collectReferencedTypeDependencies(
  ctx: ParserContext,
  typeNode: TSNode | undefined,
  referencedImportedTypes: Set<string>,
  referencedLocalTypes: Set<string>,
  visitedLocalTypes: Set<string> = new Set(),
) {
  if (!typeNode) return;

  const collect = (node: TSNode | undefined) =>
    collectReferencedTypeDependencies(ctx, node, referencedImportedTypes, referencedLocalTypes, visitedLocalTypes);

  // Cases pick the parts of a node that name types; other nodes are walked as-is.
  walk(typeNode, {
    enter(node) {
      switch (node.type) {
        case "TSInterfaceDeclaration":
          // Each `extends B<C>` clause names a type like a reference does.
          for (const heritage of node.extends ?? []) {
            collectTypeReferenceDependencies(
              ctx,
              heritage.expression,
              heritage.typeParameters?.params,
              referencedImportedTypes,
              referencedLocalTypes,
              visitedLocalTypes,
            );
          }
          collectMemberDependencies(node.body.body, collect);
          return SKIP;
        case "TSTypeAliasDeclaration":
        case "TSTypeAnnotation":
          collect(node.typeAnnotation);
          return SKIP;
        case "TSTypeLiteral":
          collectMemberDependencies(node.members, collect);
          return SKIP;
        case "TSTypeReference":
          collectTypeReferenceDependencies(
            ctx,
            node.typeName,
            node.typeArguments?.params,
            referencedImportedTypes,
            referencedLocalTypes,
            visitedLocalTypes,
          );
          return SKIP;
      }
    },
  });
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
    .sort(([sourceA], [sourceB]) => compareText(sourceA, sourceB))
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

/** A type reference's dependencies: `Name<Args>`, or an interface's `extends Name<Args>`. */
function collectTypeReferenceDependencies(
  ctx: ParserContext,
  typeName: EntityName,
  typeArguments: TypeNode[] | undefined,
  referencedImportedTypes: Set<string>,
  referencedLocalTypes: Set<string>,
  visitedLocalTypes: Set<string>,
) {
  const dependencyName = getTypeDependencyName(typeName);
  // A value import used only as a type (no `type` modifier) still needs an
  // `import type` line in the standalone `.d.ts`.
  if (ctx.typeImportBindingsByLocalName.has(dependencyName) || ctx.valueImportBindingsByLocalName.has(dependencyName)) {
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

  for (const param of typeArguments ?? []) {
    collectReferencedTypeDependencies(ctx, param, referencedImportedTypes, referencedLocalTypes, visitedLocalTypes);
  }
}

function collectMemberDependencies(members: TypeElement[], collect: (node: TSNode | undefined) => void) {
  for (const member of members) {
    if (member.type === "TSPropertySignature") collect(member.typeAnnotation?.typeAnnotation);
  }
}

/**
 * Records a type node outside the whole-object `$props()` path (legacy and
 * per-prop annotations, accessor signatures) so {@link buildTypeScriptMetadata}
 * pulls its dependencies into the `.d.ts`.
 */
export function trackAdditionalTypeDependencyNode(ctx: ParserContext, typeNode: TSNode | undefined) {
  if (typeNode) ctx.additionalTypeDependencyNodes.push(typeNode);
}

/**
 * Many bundlers reject `const enum` under `isolatedModules`, so one whose
 * members all have literal initializers is emitted as a literal union instead.
 */
function buildConstEnumUnionTypeCode(enumStatement: TSEnumDeclaration): string | undefined {
  if (!enumStatement.const) return undefined;
  const name = enumStatement.id.name;

  const literalTexts: string[] = [];
  for (const member of enumStatement.members) {
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

export function buildEnumLocalTypeDeclarationCode(
  ctx: ParserContext,
  enumStatement: TSEnumDeclaration,
): string | undefined {
  const unionCode = buildConstEnumUnionTypeCode(enumStatement);
  if (unionCode) return unionCode;

  const verbatim = sourceAtPos(ctx, enumStatement.start, enumStatement.end)?.trim();
  // A bare `enum` in a module `.d.ts` is TS1046: it emits a value, so it needs `declare`.
  return verbatim ? `declare ${verbatim}` : undefined;
}

type FunctionDeclarationLike = Pick<BaseFunction | TSDeclareMethod, "params" | "returnType" | "typeParameters">;

export interface FunctionDeclarationParam {
  name: string;
  type?: string;
  optional: boolean;
  rest: boolean;
}

/** A function's own TS annotations, as text; unset fields had no annotation. */
export interface FunctionDeclarationParts {
  params: FunctionDeclarationParam[];
  returnType?: string;
  /** `<V extends Item = Item>`, with the angle brackets. */
  typeParameters?: string;
}

/** Also records each annotation so the `.d.ts` pulls in the types it names. */
export function readFunctionDeclarationParts(
  ctx: ParserContext,
  funcDecl: FunctionDeclarationLike,
): FunctionDeclarationParts {
  const params: FunctionDeclarationParam[] = [];

  for (const rawParam of funcDecl.params) {
    // `constructor(public x: T)`: the parameter is wrapped.
    const param = rawParam.type === "TSParameterProperty" ? rawParam.parameter : rawParam;
    if (param.type === "RestElement") {
      trackAdditionalTypeDependencyNode(ctx, param.typeAnnotation?.typeAnnotation);
      params.push({
        name: param.argument.type === "Identifier" ? param.argument.name : "rest",
        type: getTypeAnnotationText(ctx, param.typeAnnotation),
        optional: false,
        rest: true,
      });
      continue;
    }

    const hasDefault = param.type === "AssignmentPattern";
    const target = hasDefault ? param.left : param;
    const annotation = "typeAnnotation" in target ? target.typeAnnotation : undefined;
    trackAdditionalTypeDependencyNode(ctx, annotation?.typeAnnotation);
    params.push({
      name: target.type === "Identifier" ? target.name : "arg",
      type: getTypeAnnotationText(ctx, annotation),
      optional: hasDefault || ("optional" in param && param.optional === true),
      rest: false,
    });
  }

  trackAdditionalTypeDependencyNode(ctx, funcDecl.returnType?.typeAnnotation);
  for (const typeParameter of funcDecl.typeParameters?.params ?? []) {
    trackAdditionalTypeDependencyNode(ctx, typeParameter.constraint);
    trackAdditionalTypeDependencyNode(ctx, typeParameter.default);
  }

  return {
    params,
    returnType: getTypeAnnotationText(ctx, funcDecl.returnType),
    // Verbatim, so the parameter and return types that name `V` still resolve.
    typeParameters: getTypeNodeText(ctx, funcDecl.typeParameters) || undefined,
  };
}

/**
 * `<T>(params) => ReturnType` for an `export function` accessor in a `lang="ts"` component,
 * with `any` for untyped positions. `hasAnnotations: false` when nothing was annotated, so the
 * caller can prefer a JSDoc-derived signature.
 */
export function buildFunctionDeclarationSignature(
  ctx: ParserContext,
  funcDecl: FunctionDeclarationLike,
): { signature: string; hasAnnotations: boolean } {
  const { params, returnType, typeParameters } = readFunctionDeclarationParts(ctx, funcDecl);
  const paramTexts = params.map(({ name, type, optional, rest }) =>
    rest ? `...${name}: ${type ?? "any[]"}` : `${name}${optional ? "?" : ""}: ${type ?? "any"}`,
  );
  const hasAnnotations =
    returnType !== undefined || typeParameters !== undefined || params.some((param) => param.type !== undefined);

  return {
    signature: `${typeParameters ?? ""}(${paramTexts.join(", ")}) => ${returnType ?? "any"}`,
    hasAnnotations,
  };
}

function copyIfAny<T>(items: T[]): T[] | undefined {
  return items.length > 0 ? items.slice() : undefined;
}

/** What the parse leaves for the cross-file pass, or `undefined` when it depends on no other file. */
export function buildPendingCrossFileCandidates(ctx: ParserContext): PendingCrossFileCandidates | undefined {
  const pendingCallDefaultCandidates = copyIfAny(ctx.pendingCallDefaultCandidates);
  const pendingConstDefaultCandidates = copyIfAny(ctx.pendingConstDefaultCandidates);
  const pendingContextKeyCandidates = copyIfAny(ctx.pendingContextKeyCandidates);
  const pendingDispatchEscapeCandidates = copyIfAny(ctx.pendingDispatchEscapeCandidates);
  if (
    !pendingCallDefaultCandidates &&
    !pendingConstDefaultCandidates &&
    !pendingContextKeyCandidates &&
    !pendingDispatchEscapeCandidates
  ) {
    return undefined;
  }

  // Both only matter to an escaped dispatcher's helpers.
  const deferredEventNoSourceDiagnostics = copyIfAny(ctx.deferredEventNoSourceDiagnostics);
  const untypedJsDocEventNames =
    pendingDispatchEscapeCandidates && ctx.untypedJsDocEventNames.size > 0
      ? Array.from(ctx.untypedJsDocEventNames)
      : undefined;
  return {
    ...(pendingCallDefaultCandidates ? { pendingCallDefaultCandidates } : {}),
    ...(pendingConstDefaultCandidates ? { pendingConstDefaultCandidates } : {}),
    ...(pendingContextKeyCandidates ? { pendingContextKeyCandidates } : {}),
    ...(pendingDispatchEscapeCandidates ? { pendingDispatchEscapeCandidates } : {}),
    ...(deferredEventNoSourceDiagnostics ? { deferredEventNoSourceDiagnostics } : {}),
    ...(untypedJsDocEventNames ? { untypedJsDocEventNames } : {}),
  };
}

/** Writer-only metadata, or `undefined` when the writer needs none. */
export function buildTypeScriptMetadata(ctx: ParserContext): ParsedComponentTypeScriptMetadata | undefined {
  const referencedImportedTypes = new Set<string>();
  const referencedLocalTypes = new Set<string>();
  for (const typeNode of ctx.additionalTypeDependencyNodes) {
    collectReferencedTypeDependencies(ctx, typeNode, referencedImportedTypes, referencedLocalTypes);
  }

  // A type the module script exports is part of the component's module API,
  // so it's emitted (exported) whether or not a prop references it.
  const exportedModuleTypes = Array.from(ctx.localTypeDeclarationsByName.values())
    .filter((declaration) => declaration.exported)
    .sort((a, b) => a.start - b.start);
  for (const declaration of exportedModuleTypes) {
    collectReferencedTypeDependencies(ctx, declaration.node, referencedImportedTypes, referencedLocalTypes);
  }
  const moduleTypeDeclarations = exportedModuleTypes.map((declaration) => `export ${declaration.code}`);

  const typedDeclaration =
    ctx.typedRunesPropsDeclarations.length === 1 ? ctx.typedRunesPropsDeclarations[0] : undefined;
  const canonicalType = typedDeclaration?.canonicalType;
  if (typedDeclaration && canonicalType) {
    for (const name of typedDeclaration.referencedImportedTypes) referencedImportedTypes.add(name);
    for (const name of typedDeclaration.referencedLocalTypes) referencedLocalTypes.add(name);
  }

  if (
    !canonicalType &&
    referencedImportedTypes.size === 0 &&
    referencedLocalTypes.size === 0 &&
    moduleTypeDeclarations.length === 0
  ) {
    return undefined;
  }

  const localTypeDeclarations = Array.from(referencedLocalTypes)
    .map((typeName) => ctx.localTypeDeclarationsByName.get(typeName))
    .filter((declaration): declaration is LocalTypeDeclaration => declaration !== undefined && !declaration.exported)
    .sort((a, b) => a.start - b.start)
    .map((declaration) => declaration.code);

  return {
    ...(canonicalType ? { canonicalPropsType: canonicalType } : {}),
    canonicalPropNames: typedDeclaration && canonicalType ? Array.from(typedDeclaration.props.keys()).sort() : [],
    localTypeDeclarations,
    ...(moduleTypeDeclarations.length > 0 ? { moduleTypeDeclarations } : {}),
    typeImportStatements: buildTypeImportStatements(ctx, referencedImportedTypes),
  };
}
