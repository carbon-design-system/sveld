/**
 * `export` declarations and specifiers, shared by the module script (whose
 * exports are module exports) and the instance script (whose exports are
 * props).
 */
import type {
  ClassDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  FunctionDeclaration,
  Identifier,
  Literal,
  Node,
  Pattern,
  Program,
  VariableDeclaration,
  VariableDeclarator,
} from "sveast";
import type { ComponentPropDefaultValue, ProcessedInitializer } from "../model";
import type { ParserContext } from "./context";
import { recordDiagnostic, recordSveldIgnore } from "./diagnostics";
import { processNodeJSDoc } from "./jsdoc";
import { resolvePropTypeAndDocs } from "./prop-shared";
import { addProp, processInitializer, queuePendingCrossFileDefault } from "./props";
import { collectPatternIdentifiers } from "./scopes";
import { sourceRangeFromNode } from "./source-position";
import { buildFunctionDeclarationSignature } from "./type-resolution";

/** Name of an export/import specifier's `local`/`exported`/`imported` (an identifier or a string literal). */
export function moduleExportName(node: Identifier | Literal | undefined): string | undefined {
  if (node?.type === "Identifier") return node.name;
  return typeof node?.value === "string" ? node.value : undefined;
}

/** {@link resolveExportSpecifier}: `declaration`/`declarator` are unset when no local declaration matched. */
export interface ResolvedExportSpecifier {
  localName: string;
  exportedName: string;
  declaration?: VariableDeclaration | FunctionDeclaration | ClassDeclaration;
  /** For a variable, the declarator whose `id` (or destructuring pattern) binds `localName`. */
  declarator?: VariableDeclarator;
  /** The top-level statement holding `declaration`, whose doc comment documents it. */
  statement?: Node;
}

/**
 * The top-level function, class, or variable declarator in `program` that binds
 * `localName`, which can come before or after the export naming it.
 */
function findTopLevelBinding(
  program: Program | null | undefined,
  localName: string,
): Pick<ResolvedExportSpecifier, "declaration" | "declarator" | "statement"> | undefined {
  for (const node of program?.body ?? []) {
    const declaration = node.type === "ExportNamedDeclaration" && node.declaration ? node.declaration : node;
    if (declaration.type === "VariableDeclaration") {
      const declarator = declaration.declarations.find((decl) =>
        decl.id.type === "Identifier" ? decl.id.name === localName : collectPatternIdentifiers(decl.id).has(localName),
      );
      if (declarator) return { declaration, declarator, statement: node };
    } else if (
      (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") &&
      declaration.id?.name === localName
    ) {
      return { declaration, statement: node };
    }
  }
  return undefined;
}

/**
 * `$: localName = value` with no other declaration of `localName` declares it,
 * so an export of it is a `let` prop initialized to `value`. Returns that
 * implied `let localName = value`.
 */
function findReactiveDeclaration(
  program: Program | null,
  localName: string,
): Pick<ResolvedExportSpecifier, "declaration" | "declarator" | "statement"> | undefined {
  for (const node of program?.body ?? []) {
    if (node.type !== "LabeledStatement" || node.label.name !== "$") continue;
    if (node.body.type !== "ExpressionStatement") continue;
    const assignment = node.body.expression;
    if (assignment.type !== "AssignmentExpression" || assignment.operator !== "=") continue;
    // `$: (x as T) = value` assigns through a TS cast, which no `let` can declare.
    if (assignment.left.type.startsWith("TS")) continue;
    if (!collectPatternIdentifiers(assignment.left).has(localName)) continue;
    const declarator: VariableDeclarator = {
      type: "VariableDeclarator",
      id: assignment.left as Pattern,
      init: assignment.right,
      start: assignment.start,
      end: assignment.end,
    };
    return {
      declaration: {
        type: "VariableDeclaration",
        kind: "let",
        declarations: [declarator],
        start: node.start,
        end: node.end,
      },
      declarator,
      statement: node,
    };
  }
  return undefined;
}

/** `var` reads as `let`; `using` / `await using` as `const`. */
function variableDeclarationKindToComponentPropKind(kind: VariableDeclaration["kind"]): "let" | "const" {
  if (kind === "var") return "let";
  if (kind === "using" || kind === "await using") return "const";
  return kind;
}

/**
 * Resolves one `export { local as exported }` specifier to the top-level
 * function, class, or variable declarator (including one destructured
 * from a pattern) it names. Each specifier resolves on its own, so
 * `export { a, b }` exports both, and `const a = 1, b = ""; export { b }`
 * exports `b`'s declarator rather than the first one in the declaration.
 *
 * `program` is the script the export sits in: only its top-level
 * declarations count, not a same-named variable inside a function. An
 * instance-script export can also name a module-script declaration, or a
 * variable that a `$: local = ...` reactive declaration declares implicitly.
 */
export function resolveExportSpecifier(
  ctx: ParserContext,
  node: ExportNamedDeclaration,
  specifier: ExportSpecifier,
  program: Program | null,
  script: "instance" | "module",
): ResolvedExportSpecifier | undefined {
  const localName = moduleExportName(specifier.local);
  const exportedName = moduleExportName(specifier.exported);
  if (!localName || !exportedName) return undefined;
  // `export { x } from "..."` names the other module's `x`, never a local one.
  if (node.source != null) return { localName, exportedName };

  let binding = findTopLevelBinding(program, localName);
  if (!binding && script === "instance") {
    binding =
      findTopLevelBinding(ctx.parsed?.module?.content, localName) ?? findReactiveDeclaration(program, localName);
  }
  return { localName, exportedName, ...binding };
}

export function recordUnresolvedExportSpecifier(
  ctx: ParserContext,
  node: ExportNamedDeclaration,
  localName: string,
  exportedName: string,
) {
  const source = node.source?.value;
  const reason =
    typeof source === "string"
      ? `it re-exports from "${source}"`
      : ctx.valueImportBindingsByLocalName.has(localName)
        ? "it re-exports an imported binding"
        : "no matching local declaration was found";
  recordDiagnostic(
    ctx,
    "export-unresolved",
    exportedName,
    `export "${exportedName}" was skipped because ${reason}; sveld only resolves exports of a local declaration.`,
    sourceRangeFromNode(ctx, node),
  );
}

/**
 * Doc comment for a declaration exported by `node`. A specifier uses the
 * comment on the declaration it names. An `export { ... }` list's own
 * comment documents it too, but only when the list has a single specifier;
 * its tags and description then override the declaration's.
 */
export function exportJSDoc(
  ctx: ParserContext,
  node: ExportNamedDeclaration,
  specifier: ResolvedExportSpecifier | undefined,
) {
  if (!specifier) return processNodeJSDoc(ctx, node);
  const listJSDoc = node.specifiers.length === 1 ? processNodeJSDoc(ctx, node) : undefined;
  const declarationJSDoc = processNodeJSDoc(ctx, specifier.statement);
  if (!listJSDoc || !declarationJSDoc) return listJSDoc ?? declarationJSDoc;
  const listFields = Object.fromEntries(Object.entries(listJSDoc).filter(([, value]) => value !== undefined));
  return { ...declarationJSDoc, ...listFields, internal: listJSDoc.internal || declarationJSDoc.internal };
}

/** One binding an exported function or variable declaration makes public, before its JSDoc is merged in. */
export interface ExportDeclarator {
  prop_name: string;
  kind: "let" | "const" | "function";
  isFunctionDeclaration: boolean;
  value: string | undefined;
  typeSeed: string | undefined;
  explicitType: string | undefined;
  initializerIsFunction: boolean;
  /** A `let` with no initializer; only instance-script props read it. */
  isRequired: boolean;
  /** The local binding; only instance-script props read it. */
  localName: string | undefined;
  defaultValue: ComponentPropDefaultValue | undefined;
  inferredTypeForSource: string | undefined;
  resolvedJSDoc:
    | Pick<
        ProcessedInitializer,
        "resolvedType" | "resolvedDescription" | "resolvedParams" | "resolvedReturnType" | "pendingCallDefault"
      >
    | undefined;
}

/**
 * The bindings `declaration` exports (all of them, or just the one
 * `specifier` names): a named function, or each variable declarator,
 * including every name a destructuring pattern binds. Empty for anything
 * else (a class, a TypeScript declaration). Queues a cross-file default for
 * `location` where an initializer needs one.
 */
export function collectExportDeclarators(
  ctx: ParserContext,
  declaration: NonNullable<ExportNamedDeclaration["declaration"]>,
  specifier: ResolvedExportSpecifier | undefined,
  location: "props" | "moduleExports",
): ExportDeclarator[] {
  const declarators: ExportDeclarator[] = [];

  if (declaration.type === "FunctionDeclaration") {
    if (!declaration.id) return declarators;
    const accessorSignature =
      ctx.scriptLanguage === "ts" ? buildFunctionDeclarationSignature(ctx, declaration) : undefined;
    declarators.push({
      prop_name: specifier?.exportedName ?? declaration.id.name,
      kind: "function",
      isFunctionDeclaration: true,
      value: undefined,
      typeSeed: accessorSignature?.hasAnnotations ? undefined : "() => any",
      explicitType: accessorSignature?.hasAnnotations ? accessorSignature.signature : undefined,
      initializerIsFunction: true,
      isRequired: false,
      localName: declaration.id.name,
      defaultValue: undefined,
      inferredTypeForSource: undefined,
      resolvedJSDoc: undefined,
    });
    return declarators;
  }

  if (declaration.type !== "VariableDeclaration") return declarators;

  const kind = variableDeclarationKindToComponentPropKind(declaration.kind);
  const declaratorsToProcess = specifier?.declarator ? [specifier.declarator] : declaration.declarations;

  for (const { id, init } of declaratorsToProcess) {
    if (id.type !== "Identifier") {
      // `export let { a, b } = obj`: each name is exported (as a prop,
      // defaulting to its part of `obj`) with no inferable type.
      for (const localPropName of collectPatternIdentifiers(id)) {
        if (specifier && specifier.localName !== localPropName) continue;
        declarators.push({
          prop_name: specifier?.exportedName ?? localPropName,
          kind,
          isFunctionDeclaration: false,
          value: undefined,
          typeSeed: undefined,
          explicitType: undefined,
          initializerIsFunction: false,
          isRequired: false,
          localName: localPropName,
          defaultValue: undefined,
          inferredTypeForSource: undefined,
          resolvedJSDoc: undefined,
        });
      }
      continue;
    }

    const localPropName = id.name;
    const declaratorPropName = specifier?.exportedName ?? localPropName;
    const initResult = init == null ? { isFunction: false } : processInitializer(ctx, init);
    const { value, type: typeSeed, isFunction: initializerIsFunction, defaultValue } = initResult;
    queuePendingCrossFileDefault(ctx, initResult, declaratorPropName, location);

    declarators.push({
      prop_name: declaratorPropName,
      kind,
      isFunctionDeclaration: false,
      value,
      typeSeed,
      explicitType: ctx.explicitPropTypesByName.get(localPropName),
      initializerIsFunction,
      isRequired: kind === "let" && init == null,
      localName: localPropName,
      defaultValue,
      inferredTypeForSource: typeSeed,
      resolvedJSDoc: initResult,
    });
  }

  return declarators;
}

/** Type, description, and signature of one exported binding, merging its JSDoc with what its initializer gave. */
export function resolveExportDeclaratorTypeAndDocs(
  ctx: ParserContext,
  declarator: ExportDeclarator,
  jsdocInfo: ReturnType<typeof exportJSDoc>,
) {
  const { resolvedJSDoc } = declarator;
  return resolvePropTypeAndDocs({
    explicitType: declarator.explicitType,
    typeSeed: declarator.typeSeed,
    inferredTypeForSource: declarator.inferredTypeForSource,
    jsdocType: jsdocInfo?.type,
    jsdocDescription: jsdocInfo?.description,
    jsdocParams: jsdocInfo?.params,
    jsdocReturnType: jsdocInfo?.returnType,
    jsdocTypeParameters: jsdocInfo?.typeParameters,
    resolvedType: resolvedJSDoc?.resolvedType,
    resolvedDescription: resolvedJSDoc?.resolvedDescription,
    resolvedParams: resolvedJSDoc?.resolvedParams,
    resolvedReturnType: resolvedJSDoc?.resolvedReturnType,
    initializerIsFunction: declarator.initializerIsFunction,
    isFunctionDeclaration: declarator.isFunctionDeclaration,
    typedefs: ctx.typedefs,
  });
}

/** An instance-script `export class Foo {}` or `export { Foo }` of a class: neither a prop nor a documented accessor. */
function recordClassExport(ctx: ParserContext, node: ExportNamedDeclaration, exportedName: string) {
  recordDiagnostic(
    ctx,
    "export-unresolved",
    exportedName,
    `export "${exportedName}" was skipped because a class can't be a prop; export it from the module script instead.`,
    sourceRangeFromNode(ctx, node),
  );
}

/** Adds the props an instance-script `export` declaration (or one specifier of an `export { ... }`) declares. */
function addInstanceDeclarationExports(
  ctx: ParserContext,
  node: ExportNamedDeclaration,
  declaration: NonNullable<ExportNamedDeclaration["declaration"]>,
  specifier?: ResolvedExportSpecifier,
) {
  if (declaration.type === "ClassDeclaration") {
    if (declaration.id) recordClassExport(ctx, node, specifier?.exportedName ?? declaration.id.name);
    return;
  }

  const declarators = collectExportDeclarators(ctx, declaration, specifier, "props");
  if (declarators.length === 0) return;

  const jsdocInfo = exportJSDoc(ctx, node, specifier);

  for (const declarator of declarators) {
    const { prop_name, kind, localName } = declarator;
    const { type, typeSource, description, params, returnType, isFunction, typeParameters } =
      resolveExportDeclaratorTypeAndDocs(ctx, declarator, jsdocInfo);

    recordSveldIgnore(ctx, "prop-unknown-type", prop_name, jsdocInfo?.sveldIgnore);

    addProp(ctx, prop_name, {
      name: prop_name,
      ...(localName !== undefined && localName !== prop_name ? { localName } : {}),
      kind,
      description,
      binding: jsdocInfo?.binding,
      deprecated: jsdocInfo?.deprecated,
      tags: jsdocInfo?.tags,
      ...(jsdocInfo?.internal ? { internal: true as const } : {}),
      type,
      typeSource,
      value: declarator.value,
      defaultValue: declarator.defaultValue,
      params,
      returnType,
      typeParameters,
      isFunction,
      isFunctionDeclaration: declarator.isFunctionDeclaration,
      isRequired: declarator.isRequired,
      constant: kind === "const",
      reactive: ctx.reactive_vars.has(prop_name),
      source: sourceRangeFromNode(ctx, node),
    });
  }
}

/** An instance-script `export` statement: its declaration's props, or each specifier's. */
export function addInstanceExports(ctx: ParserContext, node: ExportNamedDeclaration, program: Program | null) {
  if (node.declaration != null) {
    addInstanceDeclarationExports(ctx, node, node.declaration);
    return;
  }
  for (const specifier of node.specifiers) {
    const resolved = resolveExportSpecifier(ctx, node, specifier, program, "instance");
    if (!resolved) continue;
    if (resolved.declaration) {
      addInstanceDeclarationExports(ctx, node, resolved.declaration, resolved);
    } else {
      recordUnresolvedExportSpecifier(ctx, node, resolved.localName, resolved.exportedName);
    }
  }
}
