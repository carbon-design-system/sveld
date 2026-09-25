import type { CallExpression, Expression, FunctionExpression, NewExpression, Node, ObjectExpression } from "estree";
import { isIdentifier, isLiteral, isObjectExpression, resolveStaticStringLiteral } from "../ast-guards";
import type ComponentParser from "../ComponentParser";
import type { ComponentContext, ComponentContextProp, SourceRange } from "../ComponentParser";
import type { ParserContext } from "./context";
import { recordDiagnostic } from "./diagnostics";
import { parseObjectTypeLiteralMembers } from "./object-type-literal";
import { inferVariableInitializerType, literalValueType, resolveConstInitializer } from "./props";
import { isBoundInNestedScope } from "./scopes";
import { sourceForExpression, sourceRangeFromNode } from "./source-position";
import { trackAdditionalTypeDependencyNode } from "./type-resolution";

/**
 * {@link ComponentParser.findVariableTypeAndDescription} for a variable whose
 * type ends up in a context type. A TS annotation's local types and type
 * imports are then pulled into the `.d.ts`, as a prop annotation's are.
 * Without an annotation, `inferFromInitializer` types it from its initializer
 * (`let count = $state(0)` is a `number`), as a prop default is typed.
 */
function findContextVariableType(
  ctx: ParserContext,
  parser: ComponentParser,
  name: string,
  inferFromInitializer = true,
): { type: string; description?: string; internal?: boolean } | null {
  const varInfo = parser.findVariableTypeAndDescription(name);
  if (varInfo && varInfo.type === ctx.explicitVariableTypesByName.get(name)) {
    trackAdditionalTypeDependencyNode(ctx, ctx.explicitVariableTypeNodesByName.get(name));
  }
  if (varInfo || !inferFromInitializer) return varInfo;

  const inferredType = inferVariableInitializerType(parser, ctx, name);
  return inferredType ? { type: inferredType } : null;
}

/**
 * Resolves `{...identifier}` inside a `setContext` object literal to a property
 * list: either the spread-of-a-literal's own properties (recursively, so a chain
 * of `const` object literals merges all the way down) or, when the identifier
 * only has a resolvable JSDoc/native object-type annotation, that type's members.
 * Returns `null` when neither resolves, so the caller can widen to `Record<string, any>`.
 */
function resolveSpreadShape(
  ctx: ParserContext,
  parser: ComponentParser,
  argument: unknown,
  key: string,
): ComponentContextProp[] | null {
  if (!isIdentifier(argument)) return null;

  const initializer = resolveConstInitializer(ctx, argument.name);
  if (isObjectExpression(initializer)) {
    return parseContextObjectProperties(ctx, parser, initializer, key).properties;
  }

  const varInfo = findContextVariableType(ctx, parser, argument.name);
  if (!varInfo) return null;

  const members = parseObjectTypeLiteralMembers(varInfo.type);
  if (!members) return null;

  return members.map((member) => ({
    name: member.name,
    type: member.type,
    optional: member.optional,
  }));
}

/** Whether `objExpr` has a `get` accessor named `name`. */
function hasGetter(parser: ComponentParser, objExpr: ObjectExpression, name: string): boolean {
  return objExpr.properties.some(
    (other) => other.type === "Property" && other.kind === "get" && parser.getPropertyName(other.key) === name,
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

/** Type (and description, for a documented variable) of one context property's value. */
function describeContextValue(
  ctx: ParserContext,
  parser: ComponentParser,
  key: string,
  propName: string,
  prop: Node,
  value: Node | undefined,
): { type: string; description?: string; internal?: boolean } {
  if (isIdentifier(value)) {
    const varInfo = findContextVariableType(ctx, parser, value.name);
    if (varInfo) return { type: varInfo.type, description: varInfo.description, internal: varInfo.internal };
    recordDiagnostic(
      ctx,
      "context-any-type",
      propName,
      `Context "${key}" property "${propName}" has no type annotation; defaulted to "any".`,
      sourceRangeFromNode(ctx, prop),
    );
    return { type: "any" };
  }
  if (value?.type === "ArrowFunctionExpression" || value?.type === "FunctionExpression") {
    const params = value.params.map((param) => `${isIdentifier(param) ? param.name || "arg" : "arg"}: any`).join(", ");
    return { type: `(${params}) => any` };
  }
  if (isLiteral(value)) {
    return { type: literalValueType(value) ?? "null" };
  }
  return { type: "any" };
}

/** Build a context's property list from an object literal, merging or flagging spreads. */
function parseContextObjectProperties(
  ctx: ParserContext,
  parser: ComponentParser,
  objExpr: ObjectExpression,
  key: string,
): { properties: ComponentContextProp[]; hasUnresolvedSpread: boolean } {
  const properties: ComponentContextProp[] = [];
  let hasUnresolvedSpread = false;

  for (const prop of objExpr.properties) {
    if (prop.type === "SpreadElement") {
      const merged = resolveSpreadShape(ctx, parser, prop.argument, key);
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

    const propName = parser.getPropertyName(prop.key);
    if (!propName) continue;

    // `get x() {}` / `set x(v) {}` describe one property, typed by the
    // getter; a setter alone is typed by its parameter.
    if (prop.kind === "set" && hasGetter(parser, objExpr, propName)) continue;
    const accessor = prop.kind === "get" || prop.kind === "set" ? (prop.value as FunctionExpression) : undefined;
    const annotated = accessor
      ? prop.kind === "get"
        ? annotationText(ctx, accessor, "returnType")
        : annotationText(ctx, accessor.params[0], "typeAnnotation")
      : undefined;
    const described = annotated
      ? { type: annotated }
      : describeContextValue(
          ctx,
          parser,
          key,
          propName,
          prop,
          prop.kind === "get" ? returnedValue(accessor) : prop.kind === "set" ? undefined : prop.value,
        );

    properties.push({
      name: propName,
      type: described.type,
      description: described.description,
      optional: false,
      ...(described.internal ? { internal: true } : {}),
    });
  }

  return { properties, hasUnresolvedSpread };
}

/**
 * Split a `setContext` key for PascalCase naming on `_` and on any run of characters that can't
 * appear in an identifier (`-`, `.`, `:`, `/`, `@`, whitespace, ...), which also drops them.
 */
const CONTEXT_KEY_SPLIT_REGEX = /(?:_|[^\p{ID_Continue}$])+/u;
const IDENTIFIER_START_REGEX = /^[\p{ID_Start}$]/u;

/** Turn `simple-modal` into `SimpleModalContext`, `@scope/ctx` into `ScopeCtxContext`, and `123` into `_123Context`. */
export function generateContextTypeName(key: string): string {
  const parts = key.split(CONTEXT_KEY_SPLIT_REGEX);
  const capitalized = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  const typeName = `${capitalized}Context`;
  return IDENTIFIER_START_REGEX.test(typeName) ? typeName : `_${typeName}`;
}

/** Build a {@link ComponentContext} from an object literal or variable reference. */
function parseContextValue(
  ctx: ParserContext,
  parser: ComponentParser,
  node: Node,
  key: string,
): ComponentContext | null {
  if (!node || typeof node !== "object" || !("type" in node)) return null;

  if (node.type === "ObjectExpression") {
    if (!isObjectExpression(node)) {
      return null;
    }

    const { properties, hasUnresolvedSpread } = parseContextObjectProperties(ctx, parser, node, key);

    return {
      key,
      typeName: generateContextTypeName(key),
      properties,
      description: undefined,
      ...(hasUnresolvedSpread ? { hasUnresolvedSpread } : {}),
    };
  } else if (isIdentifier(node)) {
    // `getContext(key)` returns the variable itself, so the context's type is
    // the variable's type, not an object wrapping it.
    const varName = node.name;
    const annotated = findContextVariableType(ctx, parser, varName, false);

    // An untyped `const` object literal describes itself, as it does when spread.
    const initializer = annotated ? undefined : resolveConstInitializer(ctx, varName);
    if (isObjectExpression(initializer)) {
      const { properties, hasUnresolvedSpread } = parseContextObjectProperties(ctx, parser, initializer, key);
      return {
        key,
        typeName: generateContextTypeName(key),
        properties,
        description: undefined,
        ...(hasUnresolvedSpread ? { hasUnresolvedSpread } : {}),
      };
    }

    const varInfo = annotated ?? findContextVariableType(ctx, parser, varName);
    if (varInfo) {
      const members = parseObjectTypeLiteralMembers(varInfo.type);
      return {
        key,
        typeName: generateContextTypeName(key),
        ...(members ? {} : { type: varInfo.type }),
        properties: (members ?? []).map((member) => ({
          name: member.name,
          type: member.type,
          optional: member.optional,
        })),
        description: varInfo.description,
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

    return {
      key,
      typeName: generateContextTypeName(key),
      type: "any",
      properties: [],
    };
  }

  return null;
}

/** Static description from `Symbol()` / `Symbol.for()`, or `""` when unknown. Returns `null` for other calls. */
function resolveSymbolKeyDescription(node: CallExpression | NewExpression): string | null {
  const callee = node.callee;
  if (!callee || typeof callee !== "object" || !("type" in callee)) return null;

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
  if (!firstArg || typeof firstArg !== "object" || !("type" in firstArg)) return "";

  if (firstArg.type === "Literal" && typeof firstArg.value === "string") return firstArg.value;
  if (firstArg.type === "TemplateLiteral" && firstArg.quasis?.length === 1) {
    return firstArg.quasis[0].value.cooked ?? "";
  }

  /** Non-string description: treat as unnamed symbol. */
  return "";
}

/** How a `setContext` key expression resolved. */
type ContextKeyResolution =
  | { kind: "resolved"; key: string }
  /** Named import. Resolved later by reading the other file. */
  | { kind: "pending"; importSource: string; importedName: string }
  | { kind: "unresolved" };

/**
 * Resolve a `setContext` key. Literals, static templates, local `const`
 * chains (depth 5), and `Symbol()` become `{ kind: "resolved" }`. A
 * `Symbol()` with no description uses the binding name. A named import is
 * `{ kind: "pending" }` so `generateBundle` can read the other file.
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
    /** Follow const bindings, same 5-level cap as @default. */
    if (depth >= 5) return { kind: "unresolved" };

    const resolvedInit = resolveConstInitializer(ctx, node.name);
    if (resolvedInit && typeof resolvedInit === "object" && "type" in resolvedInit) {
      const init = resolvedInit as Expression;
      /** No description: use the binding name (e.g. KEY from `const KEY = Symbol()`). */
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
    if (importBinding) {
      return { kind: "pending", importSource: importBinding.source, importedName: importBinding.importedName };
    }

    return { kind: "unresolved" };
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

/** Parse `setContext(key, value)`. Imported keys go to `pendingContextKeyCandidates`. */
export function parseSetContextCall(ctx: ParserContext, parser: ComponentParser, node: Node, _parent?: Node) {
  if (!node || typeof node !== "object" || !("type" in node) || node.type !== "CallExpression") {
    return;
  }
  const callExpr = node as CallExpression;
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
      sourceRangeFromNode(ctx, node),
    );
    return;
  }

  const valueArg = callExpr.arguments[1];
  if (!valueArg) return;

  const callSource = sourceRangeFromNode(ctx, node);

  if (resolution.kind === "pending") {
    /**
     * Properties come from the local value. The key is resolved later; until
     * then the imported name labels this context in diagnostics.
     */
    const contextInfo = parseContextValue(ctx, parser, valueArg, resolution.importedName);
    if (contextInfo) {
      ctx.pendingContextKeyCandidates.push({
        importSource: resolution.importSource,
        importedName: resolution.importedName,
        ...(contextInfo.type === undefined ? {} : { type: contextInfo.type }),
        properties: contextInfo.properties,
        description: contextInfo.description,
        ...(contextInfo.hasUnresolvedSpread ? { hasUnresolvedSpread: true } : {}),
        ...(contextInfo.internal ? { internal: true } : {}),
        source: callSource,
      });
    } else {
      recordContextValueUnresolved(ctx, resolution.importedName, resolution.importedName, valueArg, callSource);
    }
    return;
  }

  const contextKey = resolution.key;
  const contextInfo = parseContextValue(ctx, parser, valueArg, contextKey);
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

  ctx.contexts.set(contextKey, { ...contextInfo, source: callSource });
}
