import type {
  ArrayExpression,
  ArrowFunctionExpression,
  BinaryExpression,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Literal,
  MemberExpression,
  NewExpression,
  ObjectExpression,
  Property,
  TemplateLiteral,
  UnaryExpression,
} from "estree";
import type { Node } from "estree-walker";
import { walk } from "estree-walker";
import { isCallExpressionNamed } from "../ast-guards";
import type ComponentParser from "../ComponentParser";
import type {
  ComponentProp,
  ComponentPropDefaultValue,
  ComponentPropDefaultValueKind,
  ComponentPropParam,
  ProcessedInitializer,
} from "../ComponentParser";
import type { ParserContext } from "./context";
import { NEWLINE_CR_REGEX, sourceAtPos, sourceForExpression } from "./source-position";
import { assignValueOrUndefined } from "./utils";

export function addProp(parser: ComponentParser, ctx: ParserContext, prop_name: string, data: ComponentProp) {
  if (assignValueOrUndefined(prop_name) === undefined) return;
  parser.trackPropLocalName(prop_name);

  if (ctx.props.has(prop_name)) {
    const existing_slot = ctx.props.get(prop_name);

    ctx.props.set(prop_name, {
      ...existing_slot,
      ...data,
    });
  } else {
    ctx.props.set(prop_name, data);
  }
}

export function processInitializer(
  parser: ComponentParser,
  ctx: ParserContext,
  init: unknown,
  depth = 0,
): ProcessedInitializer {
  let value: string | undefined;
  let type: string | undefined;
  let isFunction = false;

  if (!init || typeof init !== "object" || !("type" in init)) {
    return { value, type, isFunction };
  }

  const defaultValue = classifyDefaultValue(parser, ctx, init);

  if (
    init.type === "ObjectExpression" ||
    init.type === "BinaryExpression" ||
    init.type === "ArrayExpression" ||
    init.type === "ArrowFunctionExpression" ||
    init.type === "FunctionExpression"
  ) {
    const expr = init as ObjectExpression | BinaryExpression | ArrayExpression | ArrowFunctionExpression;
    if ("start" in expr && "end" in expr && typeof expr.start === "number" && typeof expr.end === "number") {
      value = sourceAtPos(ctx, expr.start, expr.end)?.replace(NEWLINE_CR_REGEX, " ");
    }
    type = value;
    isFunction = init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression";

    if (init.type === "BinaryExpression") {
      const binExpr = init as BinaryExpression;
      if (
        binExpr.left &&
        typeof binExpr.left === "object" &&
        "type" in binExpr.left &&
        binExpr.left.type === "Literal" &&
        "value" in binExpr.left &&
        typeof binExpr.left.value === "string"
      ) {
        type = "string";
      }
    }

    if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
      type = inferFunctionTypeFromNode(init as ArrowFunctionExpression | FunctionExpression);
      value = conciseFunctionDefaultText(ctx, init as ArrowFunctionExpression | FunctionExpression);
    }
  } else if (init.type === "UnaryExpression") {
    const unaryExpr = init as UnaryExpression;
    if (
      "start" in unaryExpr &&
      "end" in unaryExpr &&
      typeof unaryExpr.start === "number" &&
      typeof unaryExpr.end === "number"
    ) {
      value = sourceAtPos(ctx, unaryExpr.start, unaryExpr.end);
    }
    if (unaryExpr.argument) {
      if (
        typeof unaryExpr.argument === "object" &&
        "type" in unaryExpr.argument &&
        unaryExpr.argument.type === "UnaryExpression"
      ) {
        const nestedResult = processInitializer(parser, ctx, unaryExpr.argument);
        type = nestedResult.type;
      } else if (typeof unaryExpr.argument === "object" && "value" in unaryExpr.argument) {
        type = typeof (unaryExpr.argument as Literal).value;
      }
    }
  } else if (init.type === "NewExpression") {
    const newExpr = init as NewExpression;
    if (
      "start" in newExpr &&
      "end" in newExpr &&
      typeof newExpr.start === "number" &&
      typeof newExpr.end === "number"
    ) {
      value = sourceAtPos(ctx, newExpr.start, newExpr.end);
    }
    if (
      newExpr.callee &&
      typeof newExpr.callee === "object" &&
      "type" in newExpr.callee &&
      newExpr.callee.type === "Identifier"
    ) {
      const calleeName = (newExpr.callee as Identifier).name;
      if (calleeName === "Date") {
        type = "Date";
      } else if (calleeName === "Map") {
        type = "Map<any, any>";
      } else if (calleeName === "Set") {
        type = "Set<any>";
      } else if (calleeName === "WeakMap") {
        type = "WeakMap<object, any>";
      } else if (calleeName === "WeakSet") {
        type = "WeakSet<object>";
      } else if (calleeName === "Array") {
        type = "any[]";
      } else if (calleeName === "RegExp" || calleeName === "Regexp") {
        type = "RegExp";
      } else if (calleeName === "Error") {
        type = "Error";
      } else {
        type = calleeName;
      }
    }
  } else if (init.type === "CallExpression") {
    const callExpr = init as CallExpression;
    if (
      "start" in callExpr &&
      "end" in callExpr &&
      typeof callExpr.start === "number" &&
      typeof callExpr.end === "number"
    ) {
      value = sourceAtPos(ctx, callExpr.start, callExpr.end);
    }

    const callee = callExpr.callee;
    const calleeName =
      callee && typeof callee === "object" && "type" in callee && callee.type === "Identifier"
        ? (callee as Identifier).name
        : undefined;

    // `$derived`/`$state` wrap a value. Unwrap like `$bindable`, keep the rune
    // call text as `@default`.
    if ((calleeName === "$derived" || calleeName === "$state") && callExpr.arguments.length === 1 && depth < 5) {
      const inner = processInitializer(parser, ctx, callExpr.arguments[0], depth + 1);
      return { ...inner, value, defaultValue };
    }

    // Same-file function/const-arrow, or a named value import.
    if (calleeName) {
      const sameFileReturnType = resolveSameFileCallReturnType(parser, ctx, calleeName);
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

      if (ctx.funcDecls.has(calleeName) || isLocalFunctionValuedBinding(ctx, calleeName)) {
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
      pendingCallDefault: { calleeName: calleeName ?? calleeDisplayText(ctx, callee) },
    };
  } else if (init.type === "Identifier") {
    const ident = init as Identifier;
    if (depth < 5) {
      const resolvedInit = resolveLocalVarInitializer(ctx, ident.name);
      if (resolvedInit) {
        const inner = processInitializer(parser, ctx, resolvedInit, depth + 1);
        const resolvedJSDoc = parser.resolveLocalVarJSDoc(ident.name);
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
        const resolvedJSDoc = parser.resolveLocalVarJSDoc(ident.name);
        const funcNode = ctx.funcDecls.get(ident.name);
        return {
          value: funcNode ? conciseFunctionDefaultText(ctx, funcNode) : undefined,
          type: undefined,
          isFunction: true,
          defaultValue: funcNode ? classifyDefaultValue(parser, ctx, funcNode) : undefined,
          resolvedType: resolvedJSDoc?.type ?? buildFunctionTypeFromParts(resolvedJSDoc, funcNode),
          resolvedDescription: resolvedJSDoc?.description,
          resolvedParams: resolvedJSDoc?.params,
          resolvedReturnType: resolvedJSDoc?.returnType,
        };
      }
    }
    if ("start" in ident && "end" in ident && typeof ident.start === "number" && typeof ident.end === "number") {
      value = sourceAtPos(ctx, ident.start, ident.end);
    }
  } else if (init.type === "MemberExpression") {
    const memberExpr = init as MemberExpression;
    if (
      "start" in memberExpr &&
      "end" in memberExpr &&
      typeof memberExpr.start === "number" &&
      typeof memberExpr.end === "number"
    ) {
      value = sourceAtPos(ctx, memberExpr.start, memberExpr.end);
    }
    if (parser.isNumericConstant(init)) {
      type = "number";
    }
  } else if (init.type === "TemplateLiteral") {
    const template = init as TemplateLiteral;
    if (
      "start" in template &&
      "end" in template &&
      typeof template.start === "number" &&
      typeof template.end === "number"
    ) {
      value = sourceAtPos(ctx, template.start, template.end);
    }
    type = "string";
  } else if ("raw" in init && typeof init.raw === "string") {
    value = init.raw;
    if ("value" in init) {
      type = init.value == null ? undefined : typeof init.value;
    }
  }

  return { value, type, isFunction, defaultValue };
}

/**
 * Look up a local variable's initializer AST node by name.
 * Returns the init node if found, or undefined.
 */
function resolveLocalVarInitializer(ctx: ParserContext, name: string): unknown | undefined {
  for (const decl of ctx.vars) {
    for (const declarator of decl.declarations) {
      if (
        declarator.id &&
        typeof declarator.id === "object" &&
        "type" in declarator.id &&
        declarator.id.type === "Identifier" &&
        "name" in declarator.id &&
        declarator.id.name === name &&
        declarator.init
      ) {
        return declarator.init;
      }
    }
  }
  return undefined;
}

/**
 * Look up the initializer for a local `const` by name.
 *
 * {@link resolveLocalVarInitializer} also walks `let`/`var`. This method does not.
 * Props and mutable bindings can change at runtime, so they cannot be context keys.
 *
 * @param name - The variable name to look up
 * @returns The initializer node for a matching `const` binding, or undefined
 */
export function resolveConstInitializer(ctx: ParserContext, name: string): unknown | undefined {
  for (const decl of ctx.vars) {
    if (decl.kind !== "const") continue;
    for (const declarator of decl.declarations) {
      if (
        declarator.id &&
        typeof declarator.id === "object" &&
        "type" in declarator.id &&
        declarator.id.type === "Identifier" &&
        "name" in declarator.id &&
        declarator.id.name === name &&
        declarator.init
      ) {
        return declarator.init;
      }
    }
  }
  return undefined;
}

/** Callee source text for diagnostics (`now.toISOString`). Falls back to `"call"`. */
function calleeDisplayText(ctx: ParserContext, callee: unknown): string {
  if (
    callee &&
    typeof callee === "object" &&
    "start" in callee &&
    "end" in callee &&
    typeof callee.start === "number" &&
    typeof callee.end === "number"
  ) {
    return sourceAtPos(ctx, callee.start, callee.end) ?? "call";
  }
  return "call";
}

/**
 * Return type for a same-file call default (`export let id = uniqueId()`).
 * Order: JSDoc `@returns`, TS return annotation, binding `() => T`, then
 * literal returns via {@link inferReturnTypeFromNode}. Returns `undefined`
 * (not `"any"`) when nothing confident turns up.
 */
function resolveSameFileCallReturnType(
  parser: ComponentParser,
  ctx: ParserContext,
  calleeName: string,
): string | undefined {
  const resolvedJSDoc = parser.resolveLocalVarJSDoc(calleeName);
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

/** Local const/let whose initializer is an arrow or function expression. */
function isLocalFunctionValuedBinding(ctx: ParserContext, name: string): boolean {
  return localFunctionValuedInitializer(ctx, name) !== undefined;
}

/** Arrow or function-expression initializer for a local binding. */
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

/**
 * Return type from `const f: () => string = ...` when the arrow omits `): string`.
 */
function bindingCallableReturnTypeText(ctx: ParserContext, name: string): string | undefined {
  for (const decl of ctx.vars) {
    for (const declarator of decl.declarations) {
      const id = declarator.id;
      if (
        !id ||
        typeof id !== "object" ||
        !("type" in id) ||
        id.type !== "Identifier" ||
        !("name" in id) ||
        id.name !== name
      ) {
        continue;
      }
      const annotation = (
        id as unknown as { typeAnnotation?: { type?: string; typeAnnotation?: { start?: number; end?: number } } }
      ).typeAnnotation;
      if (annotation?.type !== "TSTypeAnnotation") return undefined;
      const typeNode = annotation.typeAnnotation;
      if (!typeNode || typeof typeNode.start !== "number" || typeof typeNode.end !== "number") return undefined;
      return returnTypeFromCallableTypeText(sourceAtPos(ctx, typeNode.start, typeNode.end));
    }
  }
  return undefined;
}

/** Trailing return from a callable type (`() => string` → `string`). */
function returnTypeFromCallableTypeText(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const idx = type.lastIndexOf("=>");
  if (idx === -1) return undefined;
  const ret = type.slice(idx + 2).trim();
  return ret || undefined;
}

/** Explicit TS return annotation text on a function (`): T`). */
function functionReturnTypeAnnotationText(
  ctx: ParserContext,
  node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression,
): string | undefined {
  const returnType = (
    node as unknown as { returnType?: { type?: string; typeAnnotation?: { start?: number; end?: number } } }
  ).returnType;
  if (returnType?.type !== "TSTypeAnnotation") return undefined;

  const annotation = returnType.typeAnnotation;
  if (!annotation || typeof annotation.start !== "number" || typeof annotation.end !== "number") return undefined;

  return sourceAtPos(ctx, annotation.start, annotation.end);
}

/**
 * Build a function type from `@param`/`@returns` when `@type` is missing.
 * If JSDoc has no params or return either, try the function `node`, then
 * `(...args: any[]) => any`.
 */
function buildFunctionTypeFromParts(
  jsdoc?: { params?: ComponentPropParam[]; returnType?: string },
  node?: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression,
): string {
  const returnType = jsdoc?.returnType ?? "any";
  const params = jsdoc?.params;
  if (params && params.length > 0) {
    const paramsString = params.map((param) => `${param.name}${param.optional ? "?" : ""}: ${param.type}`).join(", ");
    return `(${paramsString}) => ${returnType}`;
  }
  if (jsdoc?.returnType) {
    return `() => ${returnType}`;
  }
  if (node) {
    return inferFunctionTypeFromNode(node);
  }
  return "(...args: any[]) => any";
}

/**
 * Guess arity and return type for a function default with no JSDoc `@type`.
 * Explicit `@type`/`@param`/`@returns` on the prop beat this every time.
 * A default's body is a weak signal for the prop contract. We only read
 * named params and literal returns. Everything else becomes `any`.
 */
function inferFunctionTypeFromNode(node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression): string {
  return `(${inferParamsFromNode(node)}) => ${inferReturnTypeFromNode(node)}`;
}

/**
 * Turn params into `name: any`, or use `...args: any[]` when arity is unclear:
 * no params, destructuring, rest, or defaults.
 */
function inferParamsFromNode(node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression): string {
  const params = node.params;
  if (!Array.isArray(params) || params.length === 0) {
    return "...args: any[]";
  }
  const names: string[] = [];
  for (const param of params) {
    if (
      param &&
      typeof param === "object" &&
      "type" in param &&
      param.type === "Identifier" &&
      "name" in param &&
      typeof param.name === "string"
    ) {
      names.push(`${param.name}: any`);
    } else {
      // Destructuring, rest, or default param: use ...args: any[]
      return "...args: any[]";
    }
  }
  return names.join(", ");
}

/**
 * Infer return type from literal returns only. Every `return` must agree on
 * the same primitive. Bare `return;`, no returns, identifiers, calls,
 * objects, ternaries, async, or generators all become `any`.
 */
function inferReturnTypeFromNode(node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression): string {
  if (node.async || node.generator) {
    return "any";
  }

  const body = node.body;
  let returnArgs: unknown[];
  if (body && typeof body === "object" && "type" in body && body.type === "BlockStatement") {
    returnArgs = collectReturnArguments(body);
    if (returnArgs.length === 0) {
      return "any";
    }
  } else {
    // Expression-bodied arrow: body is the return value.
    returnArgs = [body];
  }

  let inferred: string | null = null;
  for (const arg of returnArgs) {
    const primitive = inferReturnPrimitive(arg);
    if (!primitive) {
      return "any";
    }
    if (inferred === null) {
      inferred = primitive;
    } else if (inferred !== primitive) {
      return "any";
    }
  }
  return inferred ?? "any";
}

/**
 * Walk a block body and collect each `return`'s argument, skipping nested
 * functions. Bare `return;` becomes `null`.
 *
 * Not fused with the componentRoot walk: this runs from `processInitializer`, called
 * synchronously while the outer walk is still on the ancestor `ExportNamedDeclaration`/
 * `VariableDeclaration` node, so it needs the inferred type before the outer walk would
 * otherwise reach these descendant statements. Deferring it to ride along with the outer
 * traversal would mean computing prop types in a second pass instead of inline.
 */
function collectReturnArguments(body: unknown): unknown[] {
  const returnArgs: unknown[] = [];
  walk(body as Node, {
    enter(node) {
      if (
        node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression"
      ) {
        this.skip();
        return;
      }
      if (node.type === "ReturnStatement") {
        returnArgs.push((node as { argument?: unknown }).argument ?? null);
      }
    },
  });
  return returnArgs;
}

/**
 * Map one return expression to `string`, `number`, or `boolean`, or `null`
 * if it isn't a literal, template literal, or `String`/`Number`/`Boolean` call.
 */
function inferReturnPrimitive(expr: unknown): "string" | "number" | "boolean" | null {
  if (!expr || typeof expr !== "object" || !("type" in expr)) {
    return null;
  }
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
      if (callee && typeof callee === "object" && "type" in callee && callee.type === "Identifier") {
        const name = (callee as Identifier).name;
        if (name === "String") return "string";
        if (name === "Number") return "number";
        if (name === "Boolean") return "boolean";
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Unwraps `$bindable(...)` calls so defaults are documented as their underlying values.
 */
export function unwrapBindableInitializer(init: unknown): { init?: unknown; bindable: boolean } {
  if (isCallExpressionNamed(init, "$bindable")) {
    return {
      init: init.arguments[0],
      bindable: true,
    };
  }

  return {
    init,
    bindable: false,
  };
}

/**
 * Source text of a function default's parameter list, verbatim (names only
 * matter for a value default; `inferParamsFromNode`'s `: any` annotations
 * are for the prop's *type*, not this).
 */
function paramsSourceText(
  ctx: ParserContext,
  node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression,
): string {
  const params = node.params;
  if (!Array.isArray(params) || params.length === 0) return "";
  const first = params[0] as { start?: number };
  const last = params[params.length - 1] as { end?: number };
  if (typeof first.start !== "number" || typeof last.end !== "number") return "";
  return sourceAtPos(ctx, first.start, last.end) ?? "";
}

/**
 * A concise arrow-shorthand default value for a function default (e.g.
 * `() => true`, `(value) => String(value)`), or `undefined` when the body
 * isn't trivial enough to show without clutter. Only an expression-bodied
 * arrow, an empty block, or a block with exactly one `return <expr>;`
 * qualify; anything with side effects, control flow, or multiple statements
 * is intentionally omitted from `@default` (see #203).
 */
function conciseFunctionDefaultText(
  ctx: ParserContext,
  node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression,
): string | undefined {
  // Generators can't be represented as an arrow shorthand without losing
  // `function*`/`yield` semantics; leave those to the description instead.
  if (node.generator) return undefined;

  const body = node.body;
  if (!body || typeof body !== "object" || !("type" in body)) return undefined;

  const params = paramsSourceText(ctx, node);
  const asyncPrefix = node.async ? "async " : "";

  // An object-literal arrow body needs parens (`() => ({ a: 1 })`) or it
  // reads as a block statement instead of an expression.
  const arrowBody = (expr: unknown, exprText: string) =>
    expr && typeof expr === "object" && "type" in expr && expr.type === "ObjectExpression" ? `(${exprText})` : exprText;

  if (body.type !== "BlockStatement") {
    const exprText = sourceForExpression(ctx, body);
    return exprText === undefined ? undefined : `${asyncPrefix}(${params}) => ${arrowBody(body, exprText)}`;
  }

  const statements = (body as { body: unknown[] }).body;
  if (statements.length === 0) {
    return `${asyncPrefix}(${params}) => {}`;
  }

  if (statements.length === 1) {
    const stmt = statements[0];
    if (stmt && typeof stmt === "object" && "type" in stmt && stmt.type === "ReturnStatement") {
      const arg = (stmt as { argument?: unknown }).argument;
      if (arg) {
        const exprText = sourceForExpression(ctx, arg);
        if (exprText !== undefined) return `${asyncPrefix}(${params}) => ${arrowBody(arg, exprText)}`;
      }
    }
  }

  return undefined;
}

function classifyDefaultValue(
  parser: ComponentParser,
  ctx: ParserContext,
  init: unknown,
): ComponentPropDefaultValue | undefined {
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
    const parsed = jsonSafeValueFromExpression(parser, init);
    if (parsed.ok) {
      defaultValue.value = parsed.value;
    }
  }

  return defaultValue;
}

function jsonSafeValueFromExpression(
  parser: ComponentParser,
  node: unknown,
): { ok: true; value: unknown } | { ok: false } {
  if (!node || typeof node !== "object" || !("type" in node)) return { ok: false };

  if (node.type === "Literal") {
    const value = (node as Literal).value;
    return typeof value === "bigint" ? { ok: false } : { ok: true, value };
  }

  if (node.type === "UnaryExpression") {
    const unary = node as UnaryExpression;
    const argument = unary.argument;
    if (!argument || typeof argument !== "object" || !("type" in argument) || argument.type !== "Literal") {
      return { ok: false };
    }

    const value = (argument as Literal).value;
    if (typeof value === "number") {
      if (unary.operator === "-") return { ok: true, value: -value };
      if (unary.operator === "+") return { ok: true, value };
    }
    if (typeof value === "boolean" && unary.operator === "!") {
      return { ok: true, value: !value };
    }
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
      const result = jsonSafeValueFromExpression(parser, element);
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
      const key = parser.getPropertyName(property.key as Property["key"]);
      if (!key) return { ok: false };
      const propertyValue = jsonSafeValueFromExpression(parser, property.value);
      if (!propertyValue.ok) return { ok: false };
      value[key] = propertyValue.value;
    }
    return { ok: true, value };
  }

  return { ok: false };
}
