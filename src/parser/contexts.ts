import type { ArrowFunctionExpression, CallExpression, Expression, FunctionExpression, NewExpression } from "estree";
import type { Node } from "estree-walker";
import { isIdentifier, isLiteral, isObjectExpression } from "../ast-guards";
import type ComponentParser from "../ComponentParser";
import type { ComponentContext, ComponentContextProp } from "../ComponentParser";
import type { ParserContext } from "./context";
import { recordDiagnostic } from "./diagnostics";
import { resolveConstInitializer } from "./props";
import { sourceRangeFromNode } from "./source-position";

/** Split a `setContext` key on `-`, `_`, `.`, `:`, `/`, or whitespace for PascalCase naming. */
const CONTEXT_KEY_SPLIT_REGEX = /[-_.:/\s]+/;

/** Turn `simple-modal` into `SimpleModalContext`. */
export function generateContextTypeName(key: string): string {
  const parts = key.split(CONTEXT_KEY_SPLIT_REGEX);
  const capitalized = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return `${capitalized}Context`;
}

/** Build a {@link ComponentContext} from an object literal or variable reference. */
export function parseContextValue(
  ctx: ParserContext,
  parser: ComponentParser,
  node: Node,
  key: string,
): ComponentContext | null {
  if (!node || typeof node !== "object" || !("type" in node)) return null;

  if (node.type === "ObjectExpression") {
    const properties: ComponentContextProp[] = [];
    if (!isObjectExpression(node)) {
      return null;
    }
    const objExpr = node;

    for (const prop of objExpr.properties) {
      if (prop.type !== "Property") continue;

      const propName = parser.getPropertyName(prop.key);
      if (!propName) continue;

      let propType = "any";
      let propDescription: string | undefined;

      if (isIdentifier(prop.value)) {
        const varName = prop.value.name;
        const varInfo = parser.findVariableTypeAndDescription(varName);
        if (varInfo) {
          propType = varInfo.type;
          propDescription = varInfo.description;
        } else {
          recordDiagnostic(
            ctx,
            "context-any-type",
            propName,
            `Context "${key}" property "${propName}" has no type annotation; defaulted to "any".`,
            sourceRangeFromNode(ctx, prop),
          );
          if (parser.options?.verbose) {
            console.warn(`Warning: Context "${key}" property "${propName}" has no type annotation. Using "any".`);
          }
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
      });
    }

    return {
      key,
      typeName: generateContextTypeName(key),
      properties,
      description: undefined,
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
      };
    }

    recordDiagnostic(
      ctx,
      "context-any-type",
      varName,
      `Context "${key}" variable "${varName}" has no type annotation; defaulted to "any".`,
      sourceRangeFromNode(ctx, node),
    );
    if (parser.options?.verbose) {
      console.warn(`Warning: Context "${key}" variable "${varName}" has no type annotation. Using "any".`);
    }

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
export function resolveSymbolKeyDescription(node: CallExpression | NewExpression): string | null {
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

/**
 * Resolve a `setContext` key to the string used in `{PascalCase}Context`.
 * Accepts literals, static templates, `const` chains (depth 5), and `Symbol()`.
 * Description-less symbols fall back to the binding name.
 */
export function resolveContextKey(ctx: ParserContext, keyArg: unknown, depth = 0): string | null {
  if (!keyArg || typeof keyArg !== "object" || !("type" in keyArg)) return null;
  const node = keyArg as Expression;

  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : node.value == null ? null : String(node.value);
  }

  if (node.type === "TemplateLiteral") {
    /** Static template only; interpolated templates return null. */
    if (node.quasis?.length === 1) {
      const cooked = node.quasis[0].value.cooked;
      return cooked == null ? null : cooked;
    }
    return null;
  }

  if (node.type === "CallExpression" || node.type === "NewExpression") {
    return resolveSymbolKeyDescription(node);
  }

  if (node.type === "Identifier") {
    /** Follow const bindings, same 5-level cap as @default. */
    if (depth >= 5) return null;
    const resolvedInit = resolveConstInitializer(ctx, node.name);
    if (resolvedInit && typeof resolvedInit === "object" && "type" in resolvedInit) {
      const init = resolvedInit as Expression;
      /** No description: use the binding name (e.g. KEY from `const KEY = Symbol()`). */
      if (
        (init.type === "CallExpression" || init.type === "NewExpression") &&
        resolveSymbolKeyDescription(init) === ""
      ) {
        return node.name;
      }
      return resolveContextKey(ctx, init, depth + 1);
    }
    return null;
  }

  return null;
}

/** Parse `setContext(key, value)` when the key resolves statically. */
export function parseSetContextCall(ctx: ParserContext, parser: ComponentParser, node: Node, _parent?: Node) {
  if (!node || typeof node !== "object" || !("type" in node) || node.type !== "CallExpression") {
    return;
  }
  const callExpr = node as CallExpression;
  const keyArg = callExpr.arguments[0];
  if (!keyArg) return;

  const contextKey = resolveContextKey(ctx, keyArg);

  if (!contextKey) {
    const location = ctx.componentFilePath ? ` in ${ctx.componentFilePath}` : "";
    console.warn(
      `Warning: Could not resolve setContext key${location}. Use a string literal, const-bound string, or Symbol(). Skipping context type generation.`,
    );
    return;
  }

  const valueArg = callExpr.arguments[1];
  if (!valueArg) return;

  const contextInfo = parseContextValue(ctx, parser, valueArg, contextKey);
  if (contextInfo) {
    if (ctx.contexts.has(contextKey)) {
      if (parser.options?.verbose) {
        console.warn(`Warning: Multiple setContext calls with key "${contextKey}". Using first occurrence.`);
      }
    } else {
      ctx.contexts.set(contextKey, contextInfo);
    }
  }
}
