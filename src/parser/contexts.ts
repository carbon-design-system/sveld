import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  FunctionExpression,
  NewExpression,
  ObjectExpression,
} from "estree";
import type { Node } from "estree-walker";
import { isIdentifier, isLiteral, isObjectExpression, resolveStaticStringLiteral } from "../ast-guards";
import type ComponentParser from "../ComponentParser";
import type { ComponentContext, ComponentContextProp } from "../ComponentParser";
import type { ParserContext } from "./context";
import { recordDiagnostic } from "./diagnostics";
import { parseObjectTypeLiteralMembers } from "./object-type-literal";
import { resolveConstInitializer } from "./props";
import { sourceRangeFromNode } from "./source-position";

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

  const varInfo = parser.findVariableTypeAndDescription(argument.name);
  if (!varInfo) return null;

  const members = parseObjectTypeLiteralMembers(varInfo.type);
  if (!members) return null;

  return members.map((member) => ({
    name: member.name,
    type: member.type,
    optional: member.optional,
  }));
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

    let propType = "any";
    let propDescription: string | undefined;
    let propInternal: boolean | undefined;

    if (isIdentifier(prop.value)) {
      const varName = prop.value.name;
      const varInfo = parser.findVariableTypeAndDescription(varName);
      if (varInfo) {
        propType = varInfo.type;
        propDescription = varInfo.description;
        propInternal = varInfo.internal;
      } else {
        recordDiagnostic(
          ctx,
          "context-any-type",
          propName,
          `Context "${key}" property "${propName}" has no type annotation; defaulted to "any".`,
          sourceRangeFromNode(ctx, prop),
        );
      }
    } else if (
      prop.value &&
      typeof prop.value === "object" &&
      "type" in prop.value &&
      (prop.value.type === "ArrowFunctionExpression" || prop.value.type === "FunctionExpression")
    ) {
      const funcExpr = prop.value as ArrowFunctionExpression | FunctionExpression;
      const params =
        funcExpr.params
          ?.map((p) => {
            if (isIdentifier(p)) {
              return `${p.name || "arg"}: any`;
            }
            return "arg: any";
          })
          .join(", ") || "";
      propType = `(${params}) => any`;
    } else if (isLiteral(prop.value)) {
      propType = prop.value.value == null ? "null" : typeof prop.value.value;
    }

    properties.push({
      name: propName,
      type: propType,
      description: propDescription,
      optional: false,
      ...(propInternal ? { internal: true } : {}),
    });
  }

  return { properties, hasUnresolvedSpread };
}

/** Split a `setContext` key on `-`, `_`, `.`, `:`, `/`, or whitespace for PascalCase naming. */
const CONTEXT_KEY_SPLIT_REGEX = /[-_.:/\s]+/;

/** Turn `simple-modal` into `SimpleModalContext`. */
export function generateContextTypeName(key: string): string {
  const parts = key.split(CONTEXT_KEY_SPLIT_REGEX);
  const capitalized = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return `${capitalized}Context`;
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
    const varName = node.name;
    const varInfo = parser.findVariableTypeAndDescription(varName);

    if (varInfo) {
      return {
        key,
        typeName: generateContextTypeName(key),
        properties: [
          {
            name: varName,
            type: varInfo.type,
            description: varInfo.description,
            optional: false,
          },
        ],
        description: undefined,
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
      properties: [
        {
          name: varName,
          type: "any",
          description: undefined,
          optional: false,
        },
      ],
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

    const importBinding = ctx.valueImportBindingsByLocalName.get(node.name);
    if (importBinding) {
      return { kind: "pending", importSource: importBinding.source, importedName: importBinding.importedName };
    }

    return { kind: "unresolved" };
  }

  return { kind: "unresolved" };
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
    const location = ctx.componentFilePath ? ` in ${ctx.componentFilePath}` : "";
    console.warn(
      `Warning: Could not resolve setContext key${location}. Use a string literal, const-bound string, or Symbol(). Skipping context type generation.`,
    );
    return;
  }

  const valueArg = callExpr.arguments[1];
  if (!valueArg) return;

  if (resolution.kind === "pending") {
    /** Properties come from the local value. The key is resolved later. */
    const contextInfo = parseContextValue(ctx, parser, valueArg, "");
    if (contextInfo) {
      ctx.pendingContextKeyCandidates.push({
        importSource: resolution.importSource,
        importedName: resolution.importedName,
        properties: contextInfo.properties,
        description: contextInfo.description,
      });
    }
    return;
  }

  const contextKey = resolution.key;
  const contextInfo = parseContextValue(ctx, parser, valueArg, contextKey);
  if (!contextInfo) return;

  if (ctx.contexts.has(contextKey)) {
    recordDiagnostic(
      ctx,
      "context-duplicate-key",
      contextKey,
      `setContext("${contextKey}", ...) was called more than once; only the first call's shape is used.`,
      sourceRangeFromNode(ctx, node),
    );
    return;
  }

  ctx.contexts.set(contextKey, contextInfo);
}
