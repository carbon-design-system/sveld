import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Literal,
  MemberExpression,
} from "sveast";
import { getPropertyName, isIdentifier } from "../ast-guards";
import type {
  ComponentProp,
  ComponentPropDefaultValue,
  ComponentPropDefaultValueKind,
  ComponentPropParam,
  ProcessedInitializer,
} from "../model";
import { returnTypeOfFunctionType } from "../type-text";
import type { ParserContext } from "./context";
import { trackPropLocalName } from "./context";
import { extractJsDocType } from "./jsdoc";
import { compactSourceText, nodeSourceText, sourceAtPos, sourceForExpression } from "./source-position";
import { buildFunctionDeclarationSignature, trackAdditionalTypeDependencyNode } from "./type-resolution";
import { formatParamList } from "./utils";
import { importedMemberBinding } from "./value-imports";
import { findTrackedVariableType, findVariableTypeAndDescription, resolveLocalVarJSDoc } from "./variable-jsdoc";
import { collectReturnArguments } from "./walk";

type FunctionNode = FunctionDeclaration | FunctionExpression | ArrowFunctionExpression;

export function addProp(ctx: ParserContext, prop_name: string, data: ComponentProp) {
  if (!prop_name) return;
  trackPropLocalName(ctx, prop_name);

  const existing = ctx.props.get(prop_name);
  ctx.props.set(prop_name, existing ? { ...existing, ...data } : data);
}

/** Queue an initializer's unresolved cross-file default for `generateBundle`. */
export function queuePendingCrossFileDefault(
  ctx: ParserContext,
  initResult: Pick<ProcessedInitializer, "pendingCallDefault" | "pendingConstDefault">,
  propName: string,
  location: "props" | "moduleExports",
): void {
  if (initResult.pendingCallDefault) {
    ctx.pendingCallDefaultCandidates.push({ propName, location, ...initResult.pendingCallDefault });
  }
  if (initResult.pendingConstDefault) {
    ctx.pendingConstDefaultCandidates.push({ propName, location, ...initResult.pendingConstDefault });
  }
}

/** A line break plus the indentation around it, folded to one space in default text. */
const LINE_BREAK_WITH_INDENT_REGEX = /[^\S\r\n]*[\r\n]\s*/g;

const NEW_EXPRESSION_TYPES = new Map([
  ["Date", "Date"],
  ["Map", "Map<any, any>"],
  ["Set", "Set<any>"],
  ["WeakMap", "WeakMap<object, any>"],
  ["WeakSet", "WeakSet<object>"],
  ["Array", "any[]"],
  ["RegExp", "RegExp"],
  ["Regexp", "RegExp"],
  ["Error", "Error"],
]);

/**
 * The default text, type, and metadata of an initializer. A value written
 * with a cast (`as const`, `as T`, `/** @type {T} *\/ (value)`) is typed as
 * the cast says.
 */
export function processInitializer(ctx: ParserContext, init: unknown, depth = 0): ProcessedInitializer {
  const result = processInitializerWithoutAssertion(ctx, init, depth);
  const castType = init && typeof init === "object" ? initializerCastType(ctx, init) : undefined;
  return castType === undefined ? result : { ...result, type: castType };
}

/** Only the `(` of a JSDoc cast, between its comment and expression. */
const OPEN_PAREN_BETWEEN_REGEX = /^\s*\(\s*$/;

/** The type a cast gives `init`, or `undefined` when it has none. */
function initializerCastType(ctx: ParserContext, init: object): string | undefined {
  const { constAssertions, typeAssertions } = ctx.typeCasts;
  if (constAssertions.has(init)) return literalType(init, "const");

  const annotation = typeAssertions.get(init);
  if (annotation) {
    trackAdditionalTypeDependencyNode(ctx, annotation);
    return sourceForExpression(ctx, annotation);
  }

  return jsdocCastType(ctx, init);
}

/** `T` from a JSDoc cast: `/** @type {T} *\/ (init)`. */
function jsdocCastType(ctx: ParserContext, init: object): string | undefined {
  const start = "start" in init && typeof init.start === "number" ? init.start : undefined;
  if (start === undefined) return undefined;
  const cast = ctx.parsed?.comments.findLast((comment) => comment.end <= start);
  if (cast?.type !== "Block" || !cast.value.startsWith("*")) return undefined;
  if (!OPEN_PAREN_BETWEEN_REGEX.test(sourceAtPos(ctx, cast.end, start) ?? "")) return undefined;
  return extractJsDocType(cast.value);
}

/** `node` as an expression, when it's an AST node at all. */
function asExpression(node: unknown): Expression | undefined {
  return node && typeof node === "object" && "type" in node ? (node as Expression) : undefined;
}

function processInitializerWithoutAssertion(ctx: ParserContext, init: unknown, depth: number): ProcessedInitializer {
  const node = asExpression(init);
  if (!node) return { value: undefined, type: undefined, isFunction: false };

  const defaultValue = classifyDefaultValue(ctx, node);
  const result = (value: string | undefined, type?: string): ProcessedInitializer => ({
    value,
    type,
    isFunction: false,
    defaultValue,
  });

  switch (node.type) {
    case "ObjectExpression":
    case "ArrayExpression":
      return result(compactSourceText(ctx, node), literalType(node, "widen"));
    case "BinaryExpression":
      return result(sourceForExpression(ctx, node), inferExpressionType(ctx, node, depth));
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return {
        ...result(conciseFunctionDefaultText(ctx, node), inferFunctionTypeFromNode(ctx, node)),
        isFunction: true,
      };
    case "UnaryExpression":
      return result(nodeSourceText(ctx, node), inferExpressionType(ctx, node, depth));
    case "LogicalExpression":
    case "ConditionalExpression":
    case "SequenceExpression": {
      // The whole expression is the default (`size ?? "md"`), folded onto one
      // line; a sequence keeps the parens it needs to read as one value.
      const text = nodeSourceText(ctx, node)?.replace(LINE_BREAK_WITH_INDENT_REGEX, " ");
      const value = text !== undefined && node.type === "SequenceExpression" ? `(${text})` : text;
      return result(value, inferExpressionType(ctx, node, depth));
    }
    case "NewExpression": {
      const { callee } = node;
      const type = isIdentifier(callee) ? (NEW_EXPRESSION_TYPES.get(callee.name) ?? callee.name) : undefined;
      return result(nodeSourceText(ctx, node), type);
    }
    case "CallExpression":
      return processCallInitializer(ctx, node, defaultValue, depth);
    case "Identifier": {
      const { name } = node;
      if (depth < 5) {
        const resolvedInit = resolveLocalVarInitializer(ctx, name);
        if (resolvedInit) {
          const inner = processInitializer(ctx, unwrapStateInitializer(resolvedInit), depth + 1);
          const resolvedJSDoc = resolveLocalVarJSDoc(ctx, name);
          return {
            ...inner,
            resolvedType: resolvedJSDoc?.type ?? inner.resolvedType,
            resolvedDescription: resolvedJSDoc?.description ?? inner.resolvedDescription,
            resolvedParams: resolvedJSDoc?.params ?? inner.resolvedParams,
            resolvedReturnType: resolvedJSDoc?.returnType ?? inner.resolvedReturnType,
          };
        }

        // `function defaultX() {}` has no initializer. Read JSDoc off the declaration.
        const funcNode = ctx.funcDecls.get(name);
        if (funcNode) {
          const resolvedJSDoc = resolveLocalVarJSDoc(ctx, name);
          return {
            value: conciseFunctionDefaultText(ctx, funcNode),
            type: undefined,
            isFunction: true,
            defaultValue: classifyDefaultValue(ctx, funcNode),
            resolvedType: resolvedJSDoc?.type ?? buildFunctionTypeFromParts(ctx, resolvedJSDoc, funcNode),
            resolvedDescription: resolvedJSDoc?.description,
            resolvedParams: resolvedJSDoc?.params,
            resolvedReturnType: resolvedJSDoc?.returnType,
          };
        }
      }

      // Named value import. The cross-file pass may swap in the imported literal.
      return withPendingConstDefault(result(nodeSourceText(ctx, node)), ctx.valueImportBindingsByLocalName.get(name));
    }
    case "MemberExpression":
      // Member of a namespace import (`C.DELAY`). The cross-file pass may swap in the literal.
      return withPendingConstDefault(
        result(nodeSourceText(ctx, node), isNumericConstant(node) ? "number" : undefined),
        importedMemberBinding(ctx, node),
      );
    case "TemplateLiteral":
      return result(nodeSourceText(ctx, node), "string");
    case "Literal":
      return typeof node.raw === "string" ? result(node.raw, literalValueType(node)) : result(undefined);
    default:
      return result(undefined);
  }
}

/** `initResult`, left for the cross-file pass to read the imported value `binding` names, if any. */
function withPendingConstDefault(
  initResult: ProcessedInitializer,
  binding: { source: string; importedName: string; members?: string[] } | undefined,
): ProcessedInitializer {
  if (!binding) return initResult;
  const { source: importSource, importedName, members } = binding;
  return { ...initResult, pendingConstDefault: { importSource, importedName, ...(members ? { members } : {}) } };
}

/** A call default: a `$state`/`$derived` rune unwrapped, or a call whose type may resolve here or cross-file. */
function processCallInitializer(
  ctx: ParserContext,
  call: CallExpression,
  defaultValue: ComponentPropDefaultValue | undefined,
  depth: number,
): ProcessedInitializer {
  const value = nodeSourceText(ctx, call);
  const { callee } = call;
  const calleeName = isIdentifier(callee) ? callee.name : undefined;

  // `$derived`/`$state` wrap a value. Unwrap like `$bindable`, keep the rune
  // call text as `@default`.
  if ((calleeName === "$derived" || calleeName === "$state") && call.arguments.length === 1 && depth < 5) {
    return { ...processInitializer(ctx, call.arguments[0], depth + 1), value, defaultValue };
  }

  const result = { value, type: undefined, isFunction: false, defaultValue };
  if (calleeName) {
    // `resolvedType`, not `resolvedReturnType`, which would show up as the
    // prop's `returnType` even though it isn't a function.
    const sameFileReturnType = resolveSameFileCallReturnType(ctx, calleeName);
    if (sameFileReturnType?.declared) return { ...result, resolvedType: sameFileReturnType.type };
    // Read off the function's `return`s, so it's as inferred as a literal default.
    if (sameFileReturnType) return { ...result, type: sameFileReturnType.type };

    if (ctx.funcDecls.has(calleeName) || localFunctionValuedInitializer(ctx, calleeName)) {
      return { ...result, pendingCallDefault: { calleeName } };
    }

    const importBinding = ctx.valueImportBindingsByLocalName.get(calleeName);
    if (importBinding) {
      return {
        ...result,
        pendingCallDefault: {
          calleeName,
          importSource: importBinding.source,
          importedName: importBinding.importedName,
        },
      };
    }
  }

  // Unknown callee, member call, IIFE, etc. Still pending so finalize uses
  // "any" instead of the literal type "undefined".
  return { ...result, pendingCallDefault: { calleeName: calleeName ?? nodeSourceText(ctx, callee) ?? "call" } };
}

/**
 * Type of a literal's value: `RegExp` for `/a*\/g` (not `typeof`'s
 * `object`), `bigint` for `10n`, `undefined` for `null`.
 */
export function literalValueType(node: Literal): string | undefined {
  if ("regex" in node && node.regex) return "RegExp";
  if ("bigint" in node && node.bigint) return "bigint";
  return node.value == null ? undefined : typeof node.value;
}

/** Operators whose result is always a number (or a bigint, when both operands are). */
const NUMERIC_BINARY_OPERATORS = new Set(["-", "*", "/", "%", "**", "<<", ">>", ">>>", "&", "|", "^"]);
const BOOLEAN_BINARY_OPERATORS = new Set(["==", "!=", "===", "!==", "<", "<=", ">", ">=", "in", "instanceof"]);

/**
 * Type of an operator expression (`a * 2`, `"#" + id`, `!open`, `a ?? 5`) from its
 * operators and operand types. `undefined` when that needs a type checker (`a + b`
 * of untyped values), so the caller falls back to `any`, not the expression text.
 */
function inferExpressionType(ctx: ParserContext, node: unknown, depth: number): string | undefined {
  const expr = asExpression(node);
  if (!expr) return undefined;

  switch (expr.type) {
    case "UnaryExpression": {
      const { operator, argument } = expr;
      if (operator === "!" || operator === "delete") return "boolean";
      if (operator === "typeof") return "string";
      if (operator === "void") return undefined;
      if (operator === "+") return "number";
      return inferExpressionType(ctx, argument, depth) === "bigint" ? "bigint" : "number";
    }
    case "BinaryExpression": {
      const { operator } = expr;
      if (BOOLEAN_BINARY_OPERATORS.has(operator)) return "boolean";
      const left = inferExpressionType(ctx, expr.left, depth);
      const right = inferExpressionType(ctx, expr.right, depth);
      if (left === "bigint" && right === "bigint") return "bigint";
      if (NUMERIC_BINARY_OPERATORS.has(operator)) return "number";
      if (operator !== "+") return undefined;
      if (left === "string" || right === "string") return "string";
      if (left === "number" && right === "number") return "number";
      return undefined;
    }
    case "LogicalExpression":
      return unionOfBranchTypes([
        inferExpressionType(ctx, expr.left, depth),
        inferExpressionType(ctx, expr.right, depth),
      ]);
    case "ConditionalExpression":
      return unionOfBranchTypes([
        inferExpressionType(ctx, expr.consequent, depth),
        inferExpressionType(ctx, expr.alternate, depth),
      ]);
    case "SequenceExpression":
      return inferExpressionType(ctx, expr.expressions[expr.expressions.length - 1], depth);
    case "Identifier": {
      const { name } = expr;
      if (name === "NaN" || name === "Infinity") return "number";
      if (name === "undefined") return undefined;
      const variableType = findVariableTypeAndDescription(ctx, name)?.type;
      if (variableType) return variableType;
      if (depth >= 5) return undefined;
      return inferExpressionType(ctx, resolveLocalVarInitializer(ctx, name), depth + 1);
    }
    default: {
      if (depth >= 5) return undefined;
      const result = processInitializer(ctx, expr, depth + 1);
      return result.type ?? result.resolvedType;
    }
  }
}

/** `A | B` from the branches of `??`/`||`/`&&`/`?:`, or `undefined` if any branch is unknown. */
function unionOfBranchTypes(types: Array<string | undefined>): string | undefined {
  const members = new Set<string>();
  for (const type of types) {
    if (type === undefined) return undefined;
    // A function type needs parens to be a union member.
    members.add(type.includes("=>") ? `(${type})` : type);
  }
  return members.size === 1 ? types[0] : [...members].join(" | ");
}

/**
 * How {@link literalType} types members, as TypeScript would:
 * - `"widen"`: `let x = ...`, so `{ sm: false }` is `{ sm: boolean }` and `[]` is `any[]`.
 * - `"literal"`: a `const` export, so `{ close: "close" }` and `[1, 2]` keep their literals.
 * - `"const"`: `as const`, so literals plus `readonly` members and tuples.
 */
export type LiteralTypeMode = "widen" | "literal" | "const";

/** The type of a default built only from literals, or `undefined` if any part isn't one. */
export function literalType(node: unknown, mode: LiteralTypeMode): string | undefined {
  const expr = asExpression(node);
  const widen = mode === "widen";

  switch (expr?.type) {
    case "Literal":
      if ("regex" in expr && expr.regex) return "RegExp";
      if (expr.value === null) return "null";
      return widen ? literalValueType(expr) : (expr.raw ?? undefined);
    case "TemplateLiteral":
      if (expr.expressions.length > 0) return undefined;
      return widen ? "string" : `\`${expr.quasis[0]?.value.raw ?? ""}\``;
    case "Identifier":
      return expr.name === "undefined" ? "undefined" : undefined;
    case "UnaryExpression": {
      const { operator, argument } = expr;
      if (operator !== "-" || argument.type !== "Literal") return undefined;
      const type = literalValueType(argument);
      if (type !== "number" && type !== "bigint") return undefined;
      return widen ? type : `-${argument.raw}`;
    }
    case "ArrayExpression": {
      const elements: string[] = [];
      for (const element of expr.elements) {
        const type = element === null ? undefined : literalType(element, mode);
        if (type === undefined) return undefined;
        elements.push(type);
      }
      if (mode === "literal") return `[${elements.join(", ")}]`;
      if (mode === "const") return `readonly [${elements.join(", ")}]`;
      const members = new Set(elements);
      if (members.size === 0) return "any[]";
      const element = [...members].join(" | ");
      return members.size === 1 ? `${element}[]` : `(${element})[]`;
    }
    case "ObjectExpression": {
      // A repeated key keeps its last value, as at runtime.
      const members = new Map<string, string>();
      for (const property of expr.properties) {
        if (
          property.type !== "Property" ||
          property.kind !== "init" ||
          property.computed ||
          property.method ||
          property.shorthand
        ) {
          return undefined;
        }
        const { key } = property;
        const keyText = key.type === "Identifier" ? key.name : key.type === "Literal" ? key.raw : undefined;
        const type = literalType(property.value, mode);
        if (keyText === undefined || type === undefined) return undefined;
        members.delete(keyText);
        members.set(keyText, type);
      }
      if (members.size === 0) return "{}";
      const readonly = mode === "const" ? "readonly " : "";
      return `{ ${[...members].map(([key, type]) => `${readonly}${key}: ${type}`).join("; ")} }`;
    }
    default:
      return undefined;
  }
}

/**
 * Type of an unannotated script variable from its initializer, the way a
 * prop default is typed: `let count = 0`, `let count = $state(0)`,
 * `$state.raw([1])`, `$derived(count * 2)`, `writable(0)`. A rune's type
 * argument (`$state<number>(0)`) wins over its argument. A function
 * declaration is typed as a function default is. `undefined` when unknown.
 */
/** With `exactArity`, a function is typed as a value ({@link inferFunctionValueType}), not a prop default. */
export function inferVariableInitializerType(ctx: ParserContext, name: string, exactArity = false): string | undefined {
  const init = resolveLocalVarInitializer(ctx, name);
  if (init === undefined) {
    const funcDecl = ctx.funcDecls.get(name);
    return funcDecl && localFunctionType(ctx, name, funcDecl, exactArity);
  }

  if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
    return initializerCastType(ctx, init) ?? localFunctionType(ctx, name, init, exactArity);
  }

  if (init.type === "CallExpression") {
    const storeType = svelteStoreType(ctx, init);
    if (storeType) return storeType;

    const callee = sourceForExpression(ctx, init.callee);
    if (callee === "$state" || callee === "$state.raw" || callee === "$derived") {
      const typeArgument = init.typeArguments?.params[0];
      if (typeArgument) {
        trackAdditionalTypeDependencyNode(ctx, typeArgument);
        return sourceForExpression(ctx, typeArgument);
      }
      if (callee === "$state.raw") return processInitializer(ctx, init.arguments[0], 1).type;
    }
  }

  return processInitializer(ctx, init).type;
}

/**
 * Type of the function `node` declared as `name`: its TS annotations, else
 * its JSDoc, else what {@link inferFunctionTypeFromNode} reads off the node.
 */
function localFunctionType(ctx: ParserContext, name: string, node: FunctionNode, exactArity: boolean): string {
  const annotated = buildFunctionDeclarationSignature(ctx, node);
  if (annotated.hasAnnotations) return annotated.signature;
  const jsdoc = resolveLocalVarJSDoc(ctx, name);
  if (jsdoc?.type) return jsdoc.type;
  return exactArity && !jsdoc?.params?.length && !jsdoc?.returnType
    ? inferFunctionValueType(ctx, node)
    : buildFunctionTypeFromParts(ctx, jsdoc, node);
}

const SVELTE_STORE_TYPES = new Map([
  ["writable", "Writable"],
  ["readable", "Readable"],
  ["derived", "Readable"],
  ["readonly", "Readable"],
]);

/** `T` from a store type: `Writable<T>`, `Readable<T>`, with or without the `import("svelte/store")`. */
const STORE_VALUE_TYPE_REGEX = /^(?:import\("svelte\/store"\)\.)?(?:Writable|Readable)<([\s\S]*)>$/;

/**
 * `import("svelte/store").Writable<T>` for `writable(value)`, `Readable<T>`
 * for `readable(value)` or `derived(stores, fn)`; `undefined` for any other
 * call. `T` is the type argument, else the initial value's type, else `any`.
 */
export function svelteStoreType(ctx: ParserContext, call: CallExpression): string | undefined {
  const binding = isIdentifier(call.callee) ? ctx.valueImportBindingsByLocalName.get(call.callee.name) : undefined;
  const store = binding?.source === "svelte/store" ? SVELTE_STORE_TYPES.get(binding.importedName) : undefined;
  if (!store) return undefined;

  const isDerived = binding?.importedName === "derived";
  const typeArgument = call.typeArguments?.params[isDerived ? 1 : 0];
  let valueType: string | undefined;
  if (typeArgument) {
    trackAdditionalTypeDependencyNode(ctx, typeArgument);
    valueType = sourceForExpression(ctx, typeArgument);
  } else if (binding?.importedName === "readonly") {
    // `readonly(store)` reads the value type off the store it wraps.
    const [wrapped] = call.arguments;
    const wrappedType = isIdentifier(wrapped)
      ? (findTrackedVariableType(ctx, wrapped.name)?.type ?? inferVariableInitializerType(ctx, wrapped.name))
      : wrapped?.type === "CallExpression"
        ? svelteStoreType(ctx, wrapped)
        : undefined;
    valueType = wrappedType?.trim().match(STORE_VALUE_TYPE_REGEX)?.[1];
  } else if (isDerived) {
    // A callback that takes `set` reports its value through it, not its return.
    const callback = call.arguments[1];
    const isFunction = callback?.type === "ArrowFunctionExpression" || callback?.type === "FunctionExpression";
    valueType = isFunction && callback.params.length < 2 ? inferReturnTypeFromNode(callback) : undefined;
  } else {
    const [value] = call.arguments;
    valueType =
      (isIdentifier(value) ? findTrackedVariableType(ctx, value.name)?.type : undefined) ??
      inferExpressionType(ctx, value, 0);
  }
  return `import("svelte/store").${store}<${valueType ?? "any"}>`;
}

/**
 * The value inside `$state(x)`, `$state.raw(x)`, or `$derived(x)`: a prop defaulting to such a
 * local defaults to `x`, and the rune call means nothing to a consumer.
 */
function unwrapStateInitializer(init: Expression): Expression {
  if (init.type !== "CallExpression" || init.arguments.length !== 1) return init;
  const [argument] = init.arguments;
  if (argument.type === "SpreadElement") return init;
  const { callee } = init;
  const isRune =
    (callee.type === "Identifier" && (callee.name === "$state" || callee.name === "$derived")) ||
    (callee.type === "MemberExpression" &&
      isIdentifier(callee.object) &&
      callee.object.name === "$state" &&
      isIdentifier(callee.property) &&
      callee.property.name === "raw");
  return isRune ? argument : init;
}

function resolveLocalVarInitializer(ctx: ParserContext, name: string, constOnly = false): Expression | undefined {
  for (const decl of ctx.vars) {
    if (constOnly && decl.kind !== "const") continue;
    for (const declarator of decl.declarations) {
      if (isIdentifier(declarator.id) && declarator.id.name === name && declarator.init) return declarator.init;
    }
  }
  return undefined;
}

/** Unlike `let`/`var`, a `const` can't change at runtime, so only it can be a context key. */
export function resolveConstInitializer(ctx: ParserContext, name: string): Expression | undefined {
  return resolveLocalVarInitializer(ctx, name, true);
}

/**
 * Return type for a same-file call default (`export let id = uniqueId()`).
 * Order: JSDoc `@returns`, TS return annotation, binding `() => T`, then
 * literal returns via {@link inferReturnTypeFromNode}. Returns `undefined`
 * (not `"any"`) when nothing confident turns up.
 */
/** What calling a same-file function returns; `declared` when JSDoc or TypeScript says so, not its body. */
function resolveSameFileCallReturnType(
  ctx: ParserContext,
  calleeName: string,
): { type: string; declared: boolean } | undefined {
  const resolvedJSDoc = resolveLocalVarJSDoc(ctx, calleeName);
  if (resolvedJSDoc?.returnType) return { type: resolvedJSDoc.returnType, declared: true };

  const funcNode = ctx.funcDecls.get(calleeName) ?? localFunctionValuedInitializer(ctx, calleeName);
  if (!funcNode) return undefined;

  const declared = functionReturnTypeAnnotationText(ctx, funcNode) ?? bindingCallableReturnTypeText(ctx, calleeName);
  if (declared) return { type: declared, declared: true };

  const inferred = inferReturnTypeFromNode(funcNode);
  return inferred === "any" ? undefined : { type: inferred, declared: false };
}

function localFunctionValuedInitializer(
  ctx: ParserContext,
  name: string,
): FunctionExpression | ArrowFunctionExpression | undefined {
  const init = resolveLocalVarInitializer(ctx, name);
  return init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression" ? init : undefined;
}

/** Return type from `const f: () => string = ...` when the arrow omits `): string`. */
function bindingCallableReturnTypeText(ctx: ParserContext, name: string): string | undefined {
  for (const decl of ctx.vars) {
    for (const declarator of decl.declarations) {
      const id = declarator.id;
      if (!isIdentifier(id) || id.name !== name) continue;
      const typeNode = id.typeAnnotation?.typeAnnotation;
      if (!typeNode) return undefined;
      return returnTypeOfFunctionType(sourceAtPos(ctx, typeNode.start, typeNode.end));
    }
  }
  return undefined;
}

function functionReturnTypeAnnotationText(ctx: ParserContext, node: FunctionNode): string | undefined {
  const annotation = node.returnType?.typeAnnotation;
  return annotation && sourceAtPos(ctx, annotation.start, annotation.end);
}

/**
 * A function type from JSDoc `@param`/`@returns` when `@type` is missing,
 * else what {@link inferFunctionTypeFromNode} reads off `node`.
 */
function buildFunctionTypeFromParts(
  ctx: ParserContext,
  jsdoc: { params?: ComponentPropParam[]; returnType?: string } | undefined,
  node: FunctionNode,
): string {
  const returnType = jsdoc?.returnType ?? "any";
  const params = jsdoc?.params;
  if (params && params.length > 0) return `(${formatParamList(params)}) => ${returnType}`;
  if (jsdoc?.returnType) return `() => ${returnType}`;
  return inferFunctionTypeFromNode(ctx, node);
}

/**
 * A function default's type from its node alone: named params and literal
 * returns, `any` for the rest. A default's body is a weak signal for the
 * prop's contract, so the prop's own JSDoc always wins over this.
 */
function inferFunctionTypeFromNode(ctx: ParserContext, node: FunctionNode): string {
  const returnType = inferReturnTypeFromNode(node);
  // TypeScript annotations on the function (`(value: string) => ...`) say more than its body.
  const annotated = buildFunctionDeclarationSignature(ctx, node, returnType);
  if (annotated.hasAnnotations) return annotated.signature;
  return `(${inferParamsFromNode(node)}) => ${returnType}`;
}

/**
 * Turn params into `name: any`, or use `...args: any[]` when arity is unclear:
 * no params, destructuring, rest, or defaults.
 */
function inferParamsFromNode({ params }: FunctionNode): string {
  const names: string[] = [];
  for (const param of params) {
    if (!isIdentifier(param)) return "...args: any[]";
    names.push(`${param.name}: any`);
  }
  return names.length > 0 ? names.join(", ") : "...args: any[]";
}

/**
 * The type of a function that is itself the value (an `export function`, a
 * context member), not a prop's default: its TS annotations, else each param
 * as `any` (optional when it has a default, `any[]` when rest), returning
 * what {@link inferReturnTypeFromNode} reads.
 */
export function inferFunctionValueType(ctx: ParserContext, node: FunctionNode): string {
  const returnType = returnsNothing(node) ? (node.async ? "Promise<void>" : "void") : inferReturnTypeFromNode(node);
  const annotated = buildFunctionDeclarationSignature(ctx, node, returnType);
  if (annotated.hasAnnotations) return annotated.signature;
  // A destructured param has no name of its own.
  const unnamed = (index: number) => (node.params.length === 1 ? "arg" : `arg${index}`);
  const params = node.params.map((param, index) => {
    if (param.type === "RestElement") {
      return `...${isIdentifier(param.argument) ? param.argument.name : "args"}: any[]`;
    }
    if (param.type === "AssignmentPattern") {
      return `${isIdentifier(param.left) ? param.left.name : unnamed(index)}?: any`;
    }
    return `${isIdentifier(param) ? param.name : unnamed(index)}: any`;
  });
  return `(${params.join(", ")}) => ${returnType}`;
}

/** A block-bodied function with no `return` of a value: calling it gives `undefined`. */
function returnsNothing(node: FunctionNode): boolean {
  return (
    !node.generator &&
    node.body.type === "BlockStatement" &&
    collectReturnArguments(node.body).every((argument) => argument === null)
  );
}

/**
 * Infer return type from literal returns only. Every `return` must agree on
 * the same primitive. Bare `return;`, no returns, identifiers, calls,
 * objects, ternaries, async, or generators all become `any`.
 */
function inferReturnTypeFromNode(node: FunctionNode): string {
  if (node.async || node.generator) return "any";
  const { body } = node;
  const returnArgs = body.type === "BlockStatement" ? collectReturnArguments(body) : [body];
  const primitives = new Set(returnArgs.map(inferReturnPrimitive));
  const [only] = primitives;
  return primitives.size === 1 && only ? only : "any";
}

/**
 * Map one return expression to `string`, `number`, or `boolean`, or `null`
 * if it isn't a literal, template literal, or `String`/`Number`/`Boolean` call.
 */
function inferReturnPrimitive(node: unknown): "string" | "number" | "boolean" | null {
  const expr = asExpression(node);
  switch (expr?.type) {
    case "Literal": {
      const { value } = expr;
      if (typeof value === "string") return "string";
      if (typeof value === "number") return "number";
      if (typeof value === "boolean") return "boolean";
      return null;
    }
    case "TemplateLiteral":
      return "string";
    case "CallExpression": {
      const { callee } = expr;
      if (!isIdentifier(callee)) return null;
      if (callee.name === "String") return "string";
      if (callee.name === "Number") return "number";
      if (callee.name === "Boolean") return "boolean";
      return null;
    }
    default:
      return null;
  }
}

/**
 * Source text of a function default's parameter list, verbatim (names only
 * matter for a value default; `inferParamsFromNode`'s `: any` annotations
 * are for the prop's *type*, not this).
 */
function paramsSourceText(ctx: ParserContext, { params }: FunctionNode): string {
  if (params.length === 0) return "";
  return sourceAtPos(ctx, params[0].start, params[params.length - 1].end) ?? "";
}

/**
 * A function default as arrow shorthand (`(value) => String(value)`), or `undefined` unless
 * the body is an expression, empty, or a single `return <expr>;` (see #203).
 */
function conciseFunctionDefaultText(ctx: ParserContext, node: FunctionNode): string | undefined {
  // An arrow can't be a generator.
  if (node.generator) return undefined;

  const { body } = node;
  const params = paramsSourceText(ctx, node);
  const asyncPrefix = node.async ? "async " : "";

  // An object-literal arrow body needs parens (`() => ({ a: 1 })`) to not read as a block.
  const arrowBody = (expr: { type: string }, exprText: string) =>
    expr.type === "ObjectExpression" ? `(${exprText})` : exprText;

  if (body.type !== "BlockStatement") {
    const exprText = sourceForExpression(ctx, body);
    return exprText === undefined ? undefined : `${asyncPrefix}(${params}) => ${arrowBody(body, exprText)}`;
  }

  const statements = body.body;
  if (statements.length === 0) return `${asyncPrefix}(${params}) => {}`;

  const [stmt] = statements;
  if (statements.length === 1 && stmt.type === "ReturnStatement" && stmt.argument) {
    const exprText = sourceForExpression(ctx, stmt.argument);
    if (exprText !== undefined) return `${asyncPrefix}(${params}) => ${arrowBody(stmt.argument, exprText)}`;
  }
  return undefined;
}

function defaultValueKind(node: Expression | FunctionDeclaration): ComponentPropDefaultValueKind {
  switch (node.type) {
    case "Literal":
    case "UnaryExpression":
      return "literal";
    case "TemplateLiteral":
      return node.expressions.length === 0 ? "literal" : "expression";
    case "ArrayExpression":
      return "array";
    case "ObjectExpression":
      return "object";
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "FunctionDeclaration":
      return "function";
    default:
      return "expression";
  }
}

function classifyDefaultValue(
  ctx: ParserContext,
  node: Expression | FunctionDeclaration,
): ComponentPropDefaultValue | undefined {
  const raw = sourceForExpression(ctx, node);
  if (!raw) return undefined;

  const kind = defaultValueKind(node);
  if (kind !== "literal" && kind !== "array" && kind !== "object") return { raw, kind };
  const parsed = jsonSafeValueFromExpression(node);
  if (parsed.ok) return { raw, kind, value: parsed.value };
  // `!x`, `typeof x`, `~0`: an operator, not a value sveld can write down.
  return { raw, kind: node.type === "UnaryExpression" ? "expression" : kind };
}

function jsonSafeValueFromExpression(node: unknown): { ok: true; value: unknown } | { ok: false } {
  const expr = asExpression(node);
  switch (expr?.type) {
    case "Literal":
      // A regex's value is a `RegExp` object, which JSON would turn into `{}`.
      return typeof expr.value === "bigint" || "regex" in expr ? { ok: false } : { ok: true, value: expr.value };
    case "UnaryExpression": {
      const { operator, argument } = expr;
      if (argument.type !== "Literal") return { ok: false };
      const { value } = argument;
      if (typeof value === "number") {
        if (operator === "-") return { ok: true, value: -value };
        if (operator === "+") return { ok: true, value };
      }
      if (typeof value === "boolean" && operator === "!") return { ok: true, value: !value };
      return { ok: false };
    }
    case "TemplateLiteral": {
      const { expressions, quasis } = expr;
      if (expressions.length > 0 || quasis.length !== 1) return { ok: false };
      return { ok: true, value: quasis[0].value.cooked ?? quasis[0].value.raw };
    }
    case "ArrayExpression": {
      const values: unknown[] = [];
      for (const element of expr.elements) {
        if (!element) return { ok: false };
        const result = jsonSafeValueFromExpression(element);
        if (!result.ok) return { ok: false };
        values.push(result.value);
      }
      return { ok: true, value: values };
    }
    case "ObjectExpression": {
      const value: Record<string, unknown> = {};
      for (const property of expr.properties) {
        if (property.type !== "Property" || property.computed) return { ok: false };
        const key = getPropertyName(property.key);
        if (!key) return { ok: false };
        const propertyValue = jsonSafeValueFromExpression(property.value);
        if (!propertyValue.ok) return { ok: false };
        value[key] = propertyValue.value;
      }
      return { ok: true, value };
    }
    default:
      return { ok: false };
  }
}

const NUMBER_CONSTANTS = new Set([
  "POSITIVE_INFINITY",
  "NEGATIVE_INFINITY",
  "MAX_VALUE",
  "MIN_VALUE",
  "MAX_SAFE_INTEGER",
  "MIN_SAFE_INTEGER",
  "EPSILON",
  "NaN",
]);
const MATH_CONSTANTS = new Set(["PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT2", "SQRT1_2"]);

/** `Number.MAX_SAFE_INTEGER`, `Math.PI`, and the other numeric constants on `Number` and `Math`. */
function isNumericConstant({ object, property }: MemberExpression): boolean {
  if (!isIdentifier(object) || !isIdentifier(property)) return false;
  if (object.name === "Number") return NUMBER_CONSTANTS.has(property.name);
  if (object.name === "Math") return MATH_CONSTANTS.has(property.name);
  return false;
}
