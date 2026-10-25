import type {
  CallExpression,
  Expression,
  FunctionExpression,
  Node,
  ObjectExpression,
  SimpleCallExpression,
} from "sveast";
import {
  getPropertyName,
  isIdentifier,
  isLiteral,
  isObjectExpression,
  resolveStaticStringLiteral,
} from "../ast-guards";
import type { ComponentContext, ComponentContextProp, SourceRange } from "../model";
import { extractPropertyType } from "./bindings";
import type { ParserContext } from "./context";
import { generateContextTypeName } from "./context-type-name";
import { recordDiagnostic } from "./diagnostics";
import { processNodeJSDoc } from "./jsdoc";
import { parseObjectTypeLiteralMembers } from "./object-type-literal";
import {
  inferFunctionValueType,
  inferVariableInitializerType,
  literalValueType,
  processInitializer,
  resolveConstInitializer,
  svelteStoreType,
} from "./props";
import { isBoundInNestedScope, isCalleeBoundInNestedScope } from "./scopes";
import { sourceForExpression, sourceRangeFromNode } from "./source-position";
import { importedMemberBinding, importPath } from "./value-imports";
import { findTrackedVariableType, findVariableJsDoc } from "./variable-jsdoc";

type VariableTypeInfo = NonNullable<ReturnType<typeof findTrackedVariableType>>;

/**
 * {@link findTrackedVariableType}, else with `inferFromInitializer` typed from
 * its initializer (`let count = $state(0)` is a `number`), as a prop default is.
 */
function findContextVariableType(
  ctx: ParserContext,
  name: string,
  inferFromInitializer = true,
): VariableTypeInfo | null {
  const varInfo = findTrackedVariableType(ctx, name);
  if (varInfo || !inferFromInitializer) return varInfo;

  const inferredType = inferVariableInitializerType(ctx, name, true);
  return inferredType ? { type: inferredType, ...findVariableJsDoc(ctx, name) } : null;
}

/**
 * `{...identifier}` in a `setContext` object literal: the properties of the
 * `const` object literal it's bound to (recursively), else the members of its
 * object-type annotation. `null` when neither resolves, so the caller widens
 * to `Record<string, any>`.
 */
function resolveSpreadShape(ctx: ParserContext, argument: unknown, key: string): ComponentContextProp[] | null {
  if (!isIdentifier(argument)) return null;

  const initializer = resolveConstInitializer(ctx, argument.name);
  if (isObjectExpression(initializer)) {
    return parseContextObjectProperties(ctx, initializer, key).properties;
  }

  const varInfo = findContextVariableType(ctx, argument.name);
  return varInfo ? parseObjectTypeLiteralMembers(varInfo.type) : null;
}

function hasGetter(objExpr: ObjectExpression, name: string): boolean {
  return objExpr.properties.some(
    (other) => other.type === "Property" && other.kind === "get" && getPropertyName(other.key) === name,
  );
}

/** Source text of a TS annotation (`owner[field]`, e.g. a function's `returnType`), without the colon. */
function annotationText(
  ctx: ParserContext,
  owner: unknown,
  field: "returnType" | "typeAnnotation",
): string | undefined {
  if (!owner || typeof owner !== "object" || !(field in owner)) return undefined;
  const annotation = (owner as Record<string, unknown>)[field];
  if (!annotation || typeof annotation !== "object" || !("typeAnnotation" in annotation)) return undefined;
  return sourceForExpression(ctx, annotation.typeAnnotation);
}

/** The value a getter returns when its body is a single `return` statement. */
function returnedValue(getter: FunctionExpression | undefined): Node | undefined {
  const statements = getter?.body.body;
  if (statements?.length !== 1 || statements[0].type !== "ReturnStatement") return undefined;
  return statements[0].argument ?? undefined;
}

function describeContextValue(
  ctx: ParserContext,
  key: string,
  propName: string,
  prop: Node,
  value: Node | undefined,
): VariableTypeInfo {
  const untyped = (): VariableTypeInfo => {
    recordDiagnostic(
      ctx,
      "context-any-type",
      propName,
      `Context "${key}" property "${propName}" has no type annotation; defaulted to "any".`,
      sourceRangeFromNode(ctx, prop),
    );
    return { type: "any" };
  };
  if (isIdentifier(value)) return findContextVariableType(ctx, value.name) ?? untyped();
  if (value?.type === "ArrowFunctionExpression" || value?.type === "FunctionExpression") {
    return { type: inferFunctionValueType(ctx, value) };
  }
  if (isLiteral(value)) {
    return { type: literalValueType(value) ?? "null" };
  }
  // `registry.register`, read off a local whose type sveld knows.
  if (
    value?.type === "MemberExpression" &&
    !value.computed &&
    isIdentifier(value.object) &&
    isIdentifier(value.property)
  ) {
    const objectType = findContextVariableType(ctx, value.object.name)?.type;
    const memberType = objectType && extractPropertyType(objectType, value.property.name);
    if (memberType) return { type: memberType };
  }
  if (value === undefined) return { type: "any" };
  const storeType = value.type === "CallExpression" ? svelteStoreType(ctx, value) : undefined;
  if (storeType) return { type: storeType };
  // Anything else types the way a prop default would (`a ?? b`, `cond ? x : y`, a call's `@returns`).
  const processed = processInitializer(ctx, value);
  const type = processed.type ?? processed.resolvedType;
  return type ? { type } : untyped();
}

function parseContextObjectProperties(
  ctx: ParserContext,
  objExpr: ObjectExpression,
  key: string,
): { properties: ComponentContextProp[]; hasUnresolvedSpread: boolean } {
  const properties: ComponentContextProp[] = [];
  let hasUnresolvedSpread = false;

  for (const prop of objExpr.properties) {
    if (prop.type === "SpreadElement") {
      const merged = resolveSpreadShape(ctx, prop.argument, key);
      if (merged) {
        properties.push(...merged);
      } else {
        hasUnresolvedSpread = true;
        recordDiagnostic(
          ctx,
          "spread-unresolved",
          key,
          `Context "${key}" spreads a value sveld can't resolve; its shape is widened to "Record<string, any>".`,
          sourceRangeFromNode(ctx, prop),
        );
      }
      continue;
    }

    if (prop.type !== "Property") continue;

    const propName = getPropertyName(prop.key);
    if (!propName) continue;

    // `get x() {}` / `set x(v) {}` describe one property, typed by the
    // getter; a setter alone is typed by its parameter.
    if (prop.kind === "set" && hasGetter(objExpr, propName)) continue;
    const accessor = prop.kind === "get" || prop.kind === "set" ? (prop.value as FunctionExpression) : undefined;
    const jsdoc = processNodeJSDoc(ctx, prop);
    const annotated = accessor
      ? prop.kind === "get"
        ? annotationText(ctx, accessor, "returnType")
        : annotationText(ctx, accessor.params[0], "typeAnnotation")
      : jsdoc?.type;
    const described = annotated
      ? { type: annotated, description: jsdoc?.description }
      : describeContextValue(
          ctx,
          key,
          propName,
          prop,
          prop.kind === "get" ? returnedValue(accessor) : prop.kind === "set" ? undefined : prop.value,
        );

    properties.push({
      name: propName,
      type: described.type,
      description: described.description || jsdoc?.description || undefined,
      optional: false,
      ...(described.internal ? { internal: true } : {}),
    });
  }

  return { properties, hasUnresolvedSpread };
}

function objectLiteralContext(ctx: ParserContext, objExpr: ObjectExpression, key: string): ComponentContext {
  const { properties, hasUnresolvedSpread } = parseContextObjectProperties(ctx, objExpr, key);
  return {
    key,
    typeName: generateContextTypeName(key),
    properties,
    description: undefined,
    ...(hasUnresolvedSpread ? { hasUnresolvedSpread } : {}),
  };
}

function parseContextValue(ctx: ParserContext, node: Node, key: string): ComponentContext | null {
  if (isObjectExpression(node)) return objectLiteralContext(ctx, node, key);
  const typeName = generateContextTypeName(key);
  const typed = (type: string) => ({ key, typeName, type, properties: [] });
  // A store passed as the whole value, or `null`/`undefined` to clear a parent's context.
  if (node.type === "CallExpression") {
    const storeType = svelteStoreType(ctx, node);
    return storeType ? typed(storeType) : null;
  }
  if (node.type === "Literal" && node.value === null && node.raw === "null") return typed("null");
  if (isIdentifier(node) && node.name === "undefined") return typed("undefined");
  if (!isIdentifier(node)) return null;

  // `getContext(key)` returns the variable itself, so the context's type is
  // the variable's type, not an object wrapping it.
  const varName = node.name;
  const annotated = findContextVariableType(ctx, varName, false);

  // An untyped `const` object literal describes itself, as it does when spread.
  const initializer = annotated ? undefined : resolveConstInitializer(ctx, varName);
  if (isObjectExpression(initializer)) {
    const { internal } = findVariableJsDoc(ctx, varName);
    return { ...objectLiteralContext(ctx, initializer, key), ...(internal ? { internal } : {}) };
  }

  const varInfo = annotated ?? findContextVariableType(ctx, varName);
  if (varInfo) {
    const members = parseObjectTypeLiteralMembers(varInfo.type);
    return {
      key,
      typeName,
      ...(members ? {} : { type: varInfo.type }),
      properties: members ?? [],
      description: varInfo.description || undefined,
      ...(varInfo.internal ? { internal: true } : {}),
    };
  }

  recordDiagnostic(
    ctx,
    "context-any-type",
    varName,
    `Context "${key}" variable "${varName}" has no type annotation; defaulted to "any".`,
    sourceRangeFromNode(ctx, node),
  );
  return typed("any");
}

/** Static description from `Symbol()` / `Symbol.for()`, or `""` when unknown. Returns `null` for other calls. */
function resolveSymbolKeyDescription(node: CallExpression): string | null {
  const callee = node.callee;
  const isSymbolCall = callee.type === "Identifier" && callee.name === "Symbol";
  const isSymbolFor =
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Symbol" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "for";

  if (!isSymbolCall && !isSymbolFor) return null;

  const firstArg = node.arguments[0];
  if (firstArg?.type === "Literal" && typeof firstArg.value === "string") return firstArg.value;
  if (firstArg?.type === "TemplateLiteral" && firstArg.quasis.length === 1) {
    return firstArg.quasis[0].value.cooked ?? "";
  }
  return "";
}

type PendingContextKey = { kind: "pending"; importSource: string; importedName: string; members?: string[] };

type ContextKeyResolution = { kind: "resolved"; key: string } | PendingContextKey | { kind: "unresolved" };

function pendingContextKey(binding: { source: string; importedName: string; members?: string[] }): PendingContextKey {
  return {
    kind: "pending",
    importSource: binding.source,
    importedName: binding.importedName,
    ...(binding.members ? { members: binding.members } : {}),
  };
}

/**
 * Resolve a `setContext` key. Literals, static templates, local `const`
 * chains (depth 5), and `Symbol()` become `{ kind: "resolved" }`. A
 * `Symbol()` with no description uses the binding name. A named import,
 * or a member of a namespace import (`keys.THEME`), is `{ kind: "pending" }`
 * so `generateBundle` can read the other file.
 */
function resolveContextKey(ctx: ParserContext, keyArg: unknown, depth = 0): ContextKeyResolution {
  if (!keyArg || typeof keyArg !== "object" || !("type" in keyArg)) return { kind: "unresolved" };
  const node = keyArg as Expression;

  if (node.type === "Literal" || node.type === "TemplateLiteral") {
    const value = resolveStaticStringLiteral(node);
    return value == null ? { kind: "unresolved" } : { kind: "resolved", key: value };
  }

  if (node.type === "CallExpression" || node.type === "NewExpression") {
    const description = resolveSymbolKeyDescription(node);
    return description == null ? { kind: "unresolved" } : { kind: "resolved", key: description };
  }

  if (node.type === "Identifier") {
    // Same const-chain depth cap as @default.
    if (depth >= 5) return { kind: "unresolved" };

    const resolvedInit = resolveConstInitializer(ctx, node.name);
    if (resolvedInit && typeof resolvedInit === "object" && "type" in resolvedInit) {
      const init = resolvedInit as Expression;
      // `const KEY = Symbol()` has no description, so the binding name is the key.
      if (
        (init.type === "CallExpression" || init.type === "NewExpression") &&
        resolveSymbolKeyDescription(init) === ""
      ) {
        return { kind: "resolved", key: node.name };
      }
      return resolveContextKey(ctx, init, depth + 1);
    }

    // A parameter or nested declaration by the same name hides the import.
    const importBinding =
      depth === 0 && isBoundInNestedScope(ctx, node.name)
        ? undefined
        : ctx.valueImportBindingsByLocalName.get(node.name);
    return importBinding ? pendingContextKey(importBinding) : { kind: "unresolved" };
  }

  if (node.type === "MemberExpression") {
    // As for an identifier: a parameter or nested declaration named like the import hides it.
    const importBinding =
      depth === 0 && isCalleeBoundInNestedScope(ctx, node) ? undefined : importedMemberBinding(ctx, node);
    if (importBinding) return pendingContextKey(importBinding);
  }

  return { kind: "unresolved" };
}

/** A value other than an object literal or a variable (`writable(0)`, `new Map()`) has no shape to describe. */
function recordContextValueUnresolved(
  ctx: ParserContext,
  key: string,
  keyLabel: string,
  valueArg: Node,
  callSource: SourceRange | undefined,
) {
  const valueSource = sourceForExpression(ctx, valueArg) ?? "";
  recordDiagnostic(
    ctx,
    "context-value-unresolved",
    key,
    `setContext(${keyLabel}, ${valueSource}): the value isn't an object literal or a variable, so sveld can't describe its shape; the context is skipped.`,
    callSource,
  );
}

/**
 * Parse `setContext(key, value)`. Imported keys go to `pendingContextKeyCandidates`.
 * `statement` is the call's own expression statement, whose `@internal`/`@ignore`
 * JSDoc hides the context.
 */
export function parseSetContextCall(
  ctx: ParserContext,
  callExpr: SimpleCallExpression,
  statement: { leadingComments?: unknown[]; start?: number } | null,
) {
  const keyArg = callExpr.arguments[0];
  if (!keyArg) return;

  const resolution = resolveContextKey(ctx, keyArg);

  if (resolution.kind === "unresolved" || (resolution.kind === "resolved" && !resolution.key)) {
    const keySource = sourceForExpression(ctx, keyArg) ?? "";
    recordDiagnostic(
      ctx,
      "context-key-unresolved",
      keySource,
      `setContext key \`${keySource}\` isn't a string literal, const-bound string, Symbol(), or imported \`export const\` string; the context is skipped.`,
      sourceRangeFromNode(ctx, callExpr),
    );
    return;
  }

  const valueArg = callExpr.arguments[1];
  if (!valueArg) return;

  const callSource = sourceRangeFromNode(ctx, callExpr);
  const callInternal = processNodeJSDoc(ctx, statement)?.internal === true;

  if (resolution.kind === "pending") {
    // The key resolves later; until then the imported name labels diagnostics.
    const label = importPath(resolution);
    const contextInfo = parseContextValue(ctx, valueArg, label);
    if (contextInfo) {
      ctx.pendingContextKeyCandidates.push({
        importSource: resolution.importSource,
        importedName: resolution.importedName,
        ...(resolution.members ? { members: resolution.members } : {}),
        ...(contextInfo.type === undefined ? {} : { type: contextInfo.type }),
        properties: contextInfo.properties,
        description: contextInfo.description,
        ...(contextInfo.hasUnresolvedSpread ? { hasUnresolvedSpread: true } : {}),
        ...(contextInfo.internal || callInternal ? { internal: true } : {}),
        source: callSource,
      });
    } else {
      recordContextValueUnresolved(ctx, label, label, valueArg, callSource);
    }
    return;
  }

  const contextKey = resolution.key;
  const contextInfo = parseContextValue(ctx, valueArg, contextKey);
  if (!contextInfo) {
    recordContextValueUnresolved(ctx, contextKey, JSON.stringify(contextKey), valueArg, callSource);
    return;
  }

  if (ctx.contexts.has(contextKey)) {
    recordDiagnostic(
      ctx,
      "context-duplicate-key",
      contextKey,
      `setContext("${contextKey}", ...) was called more than once; only the first call's shape is used.`,
      callSource,
    );
    return;
  }

  ctx.contexts.set(contextKey, {
    ...contextInfo,
    ...(callInternal ? { internal: true } : {}),
    source: callSource,
  });
}
