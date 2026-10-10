import type {
  ArrayExpression,
  ArrowFunctionExpression,
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Literal,
  LogicalExpression,
  MemberExpression,
  NewExpression,
  ObjectExpression,
  Property,
  SequenceExpression,
  TemplateLiteral,
  UnaryExpression,
} from "sveast";
import { getPropertyName, isCallExpressionNamed, isIdentifier } from "../ast-guards";
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
import { nodeSourceText, sourceAtPos, sourceForExpression } from "./source-position";
import { trackAdditionalTypeDependencyNode } from "./type-resolution";
import { formatParamList } from "./utils";
import { importedMemberBinding } from "./value-imports";
import { findVariableTypeAndDescription, resolveLocalVarJSDoc } from "./variable-jsdoc";
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

const JSDOC_TYPE_TAG_REGEX = /^\*\s*@type\s*\{/;
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

/**
 * `T` from a JSDoc cast, `/** @type {T} *\/ (init)`: a block comment holding
 * only an `@type` tag, then `(`, right before `init`.
 */
function jsdocCastType(ctx: ParserContext, init: object): string | undefined {
  const start = "start" in init && typeof init.start === "number" ? init.start : undefined;
  if (start === undefined) return undefined;

  let cast: { value: string; end: number } | undefined;
  for (const comment of ctx.parsed?.comments ?? []) {
    if (comment.type === "Block" && comment.end <= start && (cast === undefined || comment.end > cast.end)) {
      cast = comment;
    }
  }
  if (!cast || !JSDOC_TYPE_TAG_REGEX.test(cast.value)) return undefined;
  if (!OPEN_PAREN_BETWEEN_REGEX.test(sourceAtPos(ctx, cast.end, start) ?? "")) return undefined;

  const typeStart = cast.value.indexOf("{") + 1;
  let depth = 1;
  for (let index = typeStart; index < cast.value.length; index++) {
    if (cast.value[index] === "{") depth++;
    else if (cast.value[index] === "}" && --depth === 0) {
      return cast.value.slice(typeStart, index).trim() || undefined;
    }
  }
  return undefined;
}

function processInitializerWithoutAssertion(ctx: ParserContext, init: unknown, depth: number): ProcessedInitializer {
  let value: string | undefined;
  let type: string | undefined;
  let isFunction = false;

  if (!init || typeof init !== "object" || !("type" in init)) {
    return { value, type, isFunction };
  }

  const defaultValue = classifyDefaultValue(ctx, init);

  if (
    init.type === "ObjectExpression" ||
    init.type === "BinaryExpression" ||
    init.type === "ArrayExpression" ||
    init.type === "ArrowFunctionExpression" ||
    init.type === "FunctionExpression"
  ) {
    value = sourceForExpression(ctx, init);
    isFunction = init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression";

    if (init.type === "BinaryExpression") {
      type = inferExpressionType(ctx, init, depth);
    } else if (init.type === "ObjectExpression" || init.type === "ArrayExpression") {
      type = literalType(init, "widen");
    } else if (isFunction) {
      type = inferFunctionTypeFromNode(init as ArrowFunctionExpression | FunctionExpression);
      value = conciseFunctionDefaultText(ctx, init as ArrowFunctionExpression | FunctionExpression);
    }
  } else if (init.type === "UnaryExpression") {
    value = nodeSourceText(ctx, init);
    type = inferExpressionType(ctx, init, depth);
  } else if (
    init.type === "LogicalExpression" ||
    init.type === "ConditionalExpression" ||
    init.type === "SequenceExpression"
  ) {
    // The whole expression is the default (`size ?? "md"`), folded onto one
    // line; a sequence keeps the parens it needs to read as one value.
    const text = nodeSourceText(ctx, init)?.replace(LINE_BREAK_WITH_INDENT_REGEX, " ");
    value = text !== undefined && init.type === "SequenceExpression" ? `(${text})` : text;
    type = inferExpressionType(ctx, init, depth);
  } else if (init.type === "NewExpression") {
    value = nodeSourceText(ctx, init);
    const callee = (init as NewExpression).callee;
    if (isIdentifier(callee)) {
      type = NEW_EXPRESSION_TYPES.get(callee.name) ?? callee.name;
    }
  } else if (init.type === "CallExpression") {
    const callExpr = init as CallExpression;
    value = nodeSourceText(ctx, init);

    const callee = callExpr.callee;
    const calleeName = isIdentifier(callee) ? callee.name : undefined;

    // `$derived`/`$state` wrap a value. Unwrap like `$bindable`, keep the rune
    // call text as `@default`.
    if ((calleeName === "$derived" || calleeName === "$state") && callExpr.arguments.length === 1 && depth < 5) {
      const inner = processInitializer(ctx, callExpr.arguments[0], depth + 1);
      return { ...inner, value, defaultValue };
    }

    // Same-file function/const-arrow, or a named value import.
    if (calleeName) {
      const sameFileReturnType = resolveSameFileCallReturnType(ctx, calleeName);
      if (sameFileReturnType) {
        // Value prop: only resolvedType. resolvedReturnType would show up on
        // prop.returnType even when isFunction is false.
        return {
          value,
          type: undefined,
          isFunction: false,
          defaultValue,
          resolvedType: sameFileReturnType,
        };
      }

      if (ctx.funcDecls.has(calleeName) || localFunctionValuedInitializer(ctx, calleeName)) {
        return { value, type: undefined, isFunction: false, defaultValue, pendingCallDefault: { calleeName } };
      }

      const importBinding = ctx.valueImportBindingsByLocalName.get(calleeName);
      if (importBinding) {
        return {
          value,
          type: undefined,
          isFunction: false,
          defaultValue,
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
    return {
      value,
      type: undefined,
      isFunction: false,
      defaultValue,
      pendingCallDefault: { calleeName: calleeName ?? nodeSourceText(ctx, callee) ?? "call" },
    };
  } else if (init.type === "Identifier") {
    const ident = init as Identifier;
    if (depth < 5) {
      const resolvedInit = resolveLocalVarInitializer(ctx, ident.name);
      if (resolvedInit) {
        const inner = processInitializer(ctx, resolvedInit, depth + 1);
        const resolvedJSDoc = resolveLocalVarJSDoc(ctx, ident.name);
        return {
          ...inner,
          resolvedType: resolvedJSDoc?.type ?? inner.resolvedType,
          resolvedDescription: resolvedJSDoc?.description ?? inner.resolvedDescription,
          resolvedParams: resolvedJSDoc?.params ?? inner.resolvedParams,
          resolvedReturnType: resolvedJSDoc?.returnType ?? inner.resolvedReturnType,
        };
      }

      // `function defaultX() {}` has no initializer. Read JSDoc off the declaration.
      if (ctx.funcDecls.has(ident.name)) {
        const resolvedJSDoc = resolveLocalVarJSDoc(ctx, ident.name);
        const funcNode = ctx.funcDecls.get(ident.name);
        return {
          value: funcNode ? conciseFunctionDefaultText(ctx, funcNode) : undefined,
          type: undefined,
          isFunction: true,
          defaultValue: funcNode ? classifyDefaultValue(ctx, funcNode) : undefined,
          resolvedType: resolvedJSDoc?.type ?? buildFunctionTypeFromParts(resolvedJSDoc, funcNode),
          resolvedDescription: resolvedJSDoc?.description,
          resolvedParams: resolvedJSDoc?.params,
          resolvedReturnType: resolvedJSDoc?.returnType,
        };
      }
    }
    value = nodeSourceText(ctx, ident);

    // Named value import. The cross-file pass may swap in the imported literal.
    const importBinding = ctx.valueImportBindingsByLocalName.get(ident.name);
    if (importBinding) {
      return {
        value,
        type,
        isFunction,
        defaultValue,
        pendingConstDefault: { importSource: importBinding.source, importedName: importBinding.importedName },
      };
    }
  } else if (init.type === "MemberExpression") {
    value = nodeSourceText(ctx, init);
    if (isNumericConstant(init)) {
      type = "number";
    }

    // Member of a namespace import (`C.DELAY`). The cross-file pass may swap in the literal.
    const importBinding = importedMemberBinding(ctx, init);
    if (importBinding) {
      return {
        value,
        type,
        isFunction,
        defaultValue,
        pendingConstDefault: {
          importSource: importBinding.source,
          importedName: importBinding.importedName,
          ...(importBinding.members ? { members: importBinding.members } : {}),
        },
      };
    }
  } else if (init.type === "TemplateLiteral") {
    value = nodeSourceText(ctx, init);
    type = "string";
  } else if ("raw" in init && typeof init.raw === "string") {
    value = init.raw;
    type = literalValueType(init as Literal);
  }

  return { value, type, isFunction, defaultValue };
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
  if (!node || typeof node !== "object" || !("type" in node)) return undefined;

  switch (node.type) {
    case "UnaryExpression": {
      const unary = node as UnaryExpression;
      if (unary.operator === "!" || unary.operator === "delete") return "boolean";
      if (unary.operator === "typeof") return "string";
      if (unary.operator === "void") return undefined;
      if (unary.operator === "+") return "number";
      return inferExpressionType(ctx, unary.argument, depth) === "bigint" ? "bigint" : "number";
    }
    case "BinaryExpression": {
      const binary = node as BinaryExpression;
      if (BOOLEAN_BINARY_OPERATORS.has(binary.operator)) return "boolean";
      const left = inferExpressionType(ctx, binary.left, depth);
      const right = inferExpressionType(ctx, binary.right, depth);
      if (left === "bigint" && right === "bigint") return "bigint";
      if (NUMERIC_BINARY_OPERATORS.has(binary.operator)) return "number";
      if (binary.operator !== "+") return undefined;
      if (left === "string" || right === "string") return "string";
      if (left === "number" && right === "number") return "number";
      return undefined;
    }
    case "LogicalExpression": {
      const logical = node as LogicalExpression;
      return unionOfBranchTypes([
        inferExpressionType(ctx, logical.left, depth),
        inferExpressionType(ctx, logical.right, depth),
      ]);
    }
    case "ConditionalExpression": {
      const conditional = node as ConditionalExpression;
      return unionOfBranchTypes([
        inferExpressionType(ctx, conditional.consequent, depth),
        inferExpressionType(ctx, conditional.alternate, depth),
      ]);
    }
    case "SequenceExpression": {
      const expressions = (node as SequenceExpression).expressions;
      return inferExpressionType(ctx, expressions[expressions.length - 1], depth);
    }
    case "Identifier": {
      const name = (node as Identifier).name;
      if (name === "NaN" || name === "Infinity") return "number";
      if (name === "undefined") return undefined;
      const variableType = findVariableTypeAndDescription(ctx, name)?.type;
      if (variableType) return variableType;
      if (depth >= 5) return undefined;
      return inferExpressionType(ctx, resolveLocalVarInitializer(ctx, name), depth + 1);
    }
    default: {
      if (depth >= 5) return undefined;
      const result = processInitializer(ctx, node, depth + 1);
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
 * How {@link literalType} types a literal's members. `"widen"` is what
 * TypeScript infers for `let x = <literal>`: `{ sm: false }` is
 * `{ sm: boolean }` and `[]` is `any[]`, so a consumer can pass any value of
 * the same shape. `"literal"` keeps each member's literal type
 * (`{ close: "close" }`, `[1, 2]`), for a `const` the consumer can't
 * replace. `"const"` is what `as const` gives: literal types, `readonly`
 * members, and readonly tuples.
 */
export type LiteralTypeMode = "widen" | "literal" | "const";

/**
 * The type of a literal default, or `undefined` unless it and every member is
 * a string, number, boolean, bigint, regex, or `null` literal (or a negated
 * number), `undefined`, a template literal with no substitutions, or an object
 * or array literal of the same kind under plain keys.
 */
export function literalType(node: unknown, mode: LiteralTypeMode): string | undefined {
  if (!node || typeof node !== "object" || !("type" in node)) return undefined;
  const widen = mode === "widen";

  switch (node.type) {
    case "Literal": {
      const literal = node as Literal;
      if ("regex" in literal && literal.regex) return "RegExp";
      if (literal.value === null) return "null";
      return widen ? literalValueType(literal) : (literal.raw ?? undefined);
    }
    case "TemplateLiteral": {
      if ((node as TemplateLiteral).expressions.length > 0) return undefined;
      return widen ? "string" : `\`${(node as TemplateLiteral).quasis[0]?.value.raw ?? ""}\``;
    }
    case "Identifier":
      return (node as Identifier).name === "undefined" ? "undefined" : undefined;
    case "UnaryExpression": {
      const unary = node as UnaryExpression;
      const argument = unary.argument as Literal | undefined;
      if (unary.operator !== "-" || argument?.type !== "Literal") return undefined;
      const type = literalValueType(argument);
      if (type !== "number" && type !== "bigint") return undefined;
      return widen ? type : `-${argument.raw}`;
    }
    case "ArrayExpression": {
      const elements: string[] = [];
      for (const element of (node as ArrayExpression).elements) {
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
      for (const property of (node as ObjectExpression).properties) {
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
 * `$state.raw([1])`, `$derived(count * 2)`. A rune's type argument
 * (`$state<number>(0)`) wins over its argument. `undefined` when unknown.
 */
export function inferVariableInitializerType(ctx: ParserContext, name: string): string | undefined {
  const init = resolveLocalVarInitializer(ctx, name);
  if (!init || typeof init !== "object" || !("type" in init)) return undefined;

  if (init.type === "CallExpression") {
    const call = init as CallExpression;
    const callee = sourceForExpression(ctx, call.callee);
    if (callee === "$state" || callee === "$state.raw" || callee === "$derived") {
      const typeArgument = call.typeArguments?.params[0];
      if (typeArgument) {
        trackAdditionalTypeDependencyNode(ctx, typeArgument);
        return sourceForExpression(ctx, typeArgument);
      }
      if (callee === "$state.raw") return processInitializer(ctx, call.arguments[0], 1).type;
    }
  }

  return processInitializer(ctx, init).type;
}

function resolveLocalVarInitializer(ctx: ParserContext, name: string, constOnly = false): unknown {
  for (const decl of ctx.vars) {
    if (constOnly && decl.kind !== "const") continue;
    for (const declarator of decl.declarations) {
      if (isIdentifier(declarator.id) && declarator.id.name === name && declarator.init) return declarator.init;
    }
  }
  return undefined;
}

/** Unlike `let`/`var`, a `const` can't change at runtime, so only it can be a context key. */
export function resolveConstInitializer(ctx: ParserContext, name: string): unknown {
  return resolveLocalVarInitializer(ctx, name, true);
}

/**
 * Return type for a same-file call default (`export let id = uniqueId()`).
 * Order: JSDoc `@returns`, TS return annotation, binding `() => T`, then
 * literal returns via {@link inferReturnTypeFromNode}. Returns `undefined`
 * (not `"any"`) when nothing confident turns up.
 */
function resolveSameFileCallReturnType(ctx: ParserContext, calleeName: string): string | undefined {
  const resolvedJSDoc = resolveLocalVarJSDoc(ctx, calleeName);
  if (resolvedJSDoc?.returnType) return resolvedJSDoc.returnType;

  const funcNode = ctx.funcDecls.get(calleeName) ?? localFunctionValuedInitializer(ctx, calleeName);
  if (!funcNode) return undefined;

  const tsReturnType = functionReturnTypeAnnotationText(ctx, funcNode);
  if (tsReturnType) return tsReturnType;

  const bindingReturnType = bindingCallableReturnTypeText(ctx, calleeName);
  if (bindingReturnType) return bindingReturnType;

  const inferred = inferReturnTypeFromNode(funcNode);
  return inferred === "any" ? undefined : inferred;
}

function localFunctionValuedInitializer(
  ctx: ParserContext,
  name: string,
): FunctionExpression | ArrowFunctionExpression | undefined {
  const init = resolveLocalVarInitializer(ctx, name);
  if (!init || typeof init !== "object" || !("type" in init)) return undefined;
  if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
    return init as ArrowFunctionExpression | FunctionExpression;
  }
  return undefined;
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
 * Build a function type from `@param`/`@returns` when `@type` is missing.
 * If JSDoc has no params or return either, try the function `node`, then
 * `(...args: any[]) => any`.
 */
function buildFunctionTypeFromParts(
  jsdoc?: { params?: ComponentPropParam[]; returnType?: string },
  node?: FunctionNode,
): string {
  const returnType = jsdoc?.returnType ?? "any";
  const params = jsdoc?.params;
  if (params && params.length > 0) return `(${formatParamList(params)}) => ${returnType}`;
  if (jsdoc?.returnType) return `() => ${returnType}`;
  return node ? inferFunctionTypeFromNode(node) : "(...args: any[]) => any";
}

/**
 * Guess arity and return type for a function default with no JSDoc `@type`.
 * Explicit `@type`/`@param`/`@returns` on the prop beat this every time.
 * A default's body is a weak signal for the prop contract. We only read
 * named params and literal returns. Everything else becomes `any`.
 */
function inferFunctionTypeFromNode(node: FunctionNode): string {
  return `(${inferParamsFromNode(node)}) => ${inferReturnTypeFromNode(node)}`;
}

/**
 * Turn params into `name: any`, or use `...args: any[]` when arity is unclear:
 * no params, destructuring, rest, or defaults.
 */
function inferParamsFromNode(node: FunctionNode): string {
  const params = node.params;
  if (!Array.isArray(params) || params.length === 0) return "...args: any[]";
  const names: string[] = [];
  for (const param of params) {
    if (!isIdentifier(param)) return "...args: any[]";
    names.push(`${param.name}: any`);
  }
  return names.join(", ");
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
function inferReturnPrimitive(expr: unknown): "string" | "number" | "boolean" | null {
  if (!expr || typeof expr !== "object" || !("type" in expr)) return null;
  switch (expr.type) {
    case "Literal": {
      const value = (expr as Literal).value;
      if (typeof value === "string") return "string";
      if (typeof value === "number") return "number";
      if (typeof value === "boolean") return "boolean";
      return null;
    }
    case "TemplateLiteral":
      return "string";
    case "CallExpression": {
      const callee = (expr as CallExpression).callee;
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

/** Unwraps `$bindable(...)` so the default is documented as its underlying value. */
export function unwrapBindableInitializer(init: unknown): { init?: unknown; bindable: boolean } {
  return isCallExpressionNamed(init, "$bindable")
    ? { init: init.arguments[0], bindable: true }
    : { init, bindable: false };
}

/**
 * Source text of a function default's parameter list, verbatim (names only
 * matter for a value default; `inferParamsFromNode`'s `: any` annotations
 * are for the prop's *type*, not this).
 */
function paramsSourceText(ctx: ParserContext, node: FunctionNode): string {
  const params = node.params;
  if (!Array.isArray(params) || params.length === 0) return "";
  const first = params[0] as { start?: number };
  const last = params[params.length - 1] as { end?: number };
  if (typeof first.start !== "number" || typeof last.end !== "number") return "";
  return sourceAtPos(ctx, first.start, last.end) ?? "";
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

function classifyDefaultValue(ctx: ParserContext, init: unknown): ComponentPropDefaultValue | undefined {
  const raw = sourceForExpression(ctx, init);
  if (!raw || !init || typeof init !== "object" || !("type" in init)) return undefined;

  let kind: ComponentPropDefaultValueKind = "expression";
  if (init.type === "Literal" || init.type === "UnaryExpression") {
    kind = "literal";
  } else if (init.type === "TemplateLiteral") {
    kind = (init as TemplateLiteral).expressions.length === 0 ? "literal" : "expression";
  } else if (init.type === "ArrayExpression") {
    kind = "array";
  } else if (init.type === "ObjectExpression") {
    kind = "object";
  } else if (
    init.type === "ArrowFunctionExpression" ||
    init.type === "FunctionExpression" ||
    init.type === "FunctionDeclaration"
  ) {
    kind = "function";
  }

  const defaultValue: ComponentPropDefaultValue = { raw, kind };
  if (kind === "literal" || kind === "array" || kind === "object") {
    const parsed = jsonSafeValueFromExpression(init);
    if (parsed.ok) defaultValue.value = parsed.value;
  }

  return defaultValue;
}

function jsonSafeValueFromExpression(node: unknown): { ok: true; value: unknown } | { ok: false } {
  if (!node || typeof node !== "object" || !("type" in node)) return { ok: false };

  if (node.type === "Literal") {
    const value = (node as Literal).value;
    // A regex's value is a `RegExp` object, which JSON would turn into `{}`.
    return typeof value === "bigint" || "regex" in node ? { ok: false } : { ok: true, value };
  }

  if (node.type === "UnaryExpression") {
    const { operator, argument } = node as UnaryExpression;
    if (argument?.type !== "Literal") return { ok: false };
    const { value } = argument;
    if (typeof value === "number") {
      if (operator === "-") return { ok: true, value: -value };
      if (operator === "+") return { ok: true, value };
    }
    if (typeof value === "boolean" && operator === "!") return { ok: true, value: !value };
    return { ok: false };
  }

  if (node.type === "TemplateLiteral") {
    const template = node as TemplateLiteral;
    if (template.expressions.length > 0 || template.quasis.length !== 1) return { ok: false };
    return { ok: true, value: template.quasis[0].value.cooked ?? template.quasis[0].value.raw };
  }

  if (node.type === "ArrayExpression") {
    const array = node as ArrayExpression;
    const values: unknown[] = [];
    for (const element of array.elements) {
      if (!element) return { ok: false };
      const result = jsonSafeValueFromExpression(element);
      if (!result.ok) return { ok: false };
      values.push(result.value);
    }
    return { ok: true, value: values };
  }

  if (node.type === "ObjectExpression") {
    const object = node as ObjectExpression;
    const value: Record<string, unknown> = {};
    for (const property of object.properties) {
      if (property.type !== "Property" || property.computed) return { ok: false };
      const key = getPropertyName(property.key as Property["key"]);
      if (!key) return { ok: false };
      const propertyValue = jsonSafeValueFromExpression(property.value);
      if (!propertyValue.ok) return { ok: false };
      value[key] = propertyValue.value;
    }
    return { ok: true, value };
  }

  return { ok: false };
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
function isNumericConstant(memberExpr: unknown): boolean {
  if (!memberExpr || typeof memberExpr !== "object" || !("type" in memberExpr)) return false;
  if (memberExpr.type !== "MemberExpression") return false;

  const expr = memberExpr as MemberExpression;
  const objectName = expr.object && "name" in expr.object ? (expr.object as Identifier).name : undefined;
  const propertyName = expr.property && "name" in expr.property ? (expr.property as Identifier).name : undefined;

  if (!objectName || !propertyName) return false;
  if (objectName === "Number") return NUMBER_CONSTANTS.has(propertyName);
  if (objectName === "Math") return MATH_CONSTANTS.has(propertyName);
  return false;
}
