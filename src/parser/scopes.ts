import type {
  ArrowFunctionExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Pattern,
  VariableDeclaration,
  VariableDeclarator,
} from "estree";
import { isCallExpressionNamed, isVariableDeclaration, unwrapTypeCastExpression } from "../ast-guards";
import type ComponentParser from "../ComponentParser";
import type { LexicalScope, ScopeBinding, ScopeBindingKind } from "../ComponentParser";
import type { ParserContext } from "./context";

/** Declares `name` into `scope` unless it's empty/already bound (first declaration wins). */
export function declareScopeBinding(scope: LexicalScope, name: string, binding: ScopeBinding) {
  if (!name || scope.has(name)) return;
  scope.set(name, binding);
}

/** Resolves `name` to its public prop name by walking active scopes innermost-first. */
export function resolveIdentifierToReactiveProp(ctx: ParserContext, name: string) {
  for (let i = ctx.activeScopes.length - 1; i >= 0; i -= 1) {
    const binding = ctx.activeScopes[i]?.get(name);
    if (!binding) continue;
    return binding.kind === "prop" ? binding.publicPropName : undefined;
  }

  return undefined;
}

/** Collects all identifier names bound by a destructuring/assignment pattern (or plain expression). */
export function collectPatternIdentifiers(
  target: Pattern | Expression | null | undefined,
  names: Set<string> = new Set(),
) {
  if (!target || typeof target !== "object" || !("type" in target)) return names;

  switch (target.type) {
    case "Identifier":
      names.add(target.name);
      break;
    case "AssignmentPattern":
      collectPatternIdentifiers(target.left, names);
      break;
    case "ArrayPattern":
      for (const element of target.elements) {
        collectPatternIdentifiers(element ?? undefined, names);
      }
      break;
    case "ObjectPattern":
      for (const property of target.properties) {
        if (property.type === "Property") {
          collectPatternIdentifiers(property.value as Pattern, names);
        } else if (property.type === "RestElement") {
          collectPatternIdentifiers(property.argument, names);
        }
      }
      break;
    case "RestElement":
      collectPatternIdentifiers(target.argument, names);
      break;
  }

  return names;
}

/** Marks any reactive props referenced by a mutation target (assignment LHS / update argument) as reactive. */
export function markReactivePropsFromMutationTarget(
  ctx: ParserContext,
  target: Pattern | Expression | null | undefined,
) {
  const identifiers = collectPatternIdentifiers(target);

  if (!identifiers) return;

  for (const identifier of identifiers) {
    const publicPropName = resolveIdentifierToReactiveProp(ctx, identifier);
    if (publicPropName) {
      ctx.reactive_vars.add(publicPropName);
    }
  }
}

/** True for AST/Svelte node types that introduce a new lexical scope. */
export function isScopeOwner(node: unknown) {
  if (!node || typeof node !== "object" || !("type" in node)) return false;

  switch (String(node.type)) {
    case "BlockStatement":
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
    case "CatchClause":
    case "EachBlock":
    case "ThenBlock":
    case "CatchBlock":
      return true;
    default:
      return false;
  }
}

/** True for node types that introduce a new `var`-hoisting (function) scope. */
export function isFunctionScopeOwner(node: unknown) {
  if (!node || typeof node !== "object" || !("type" in node)) return false;
  const type = String(node.type);
  return type === "FunctionDeclaration" || type === "FunctionExpression" || type === "ArrowFunctionExpression";
}

/** Returns the scope map for `node`, creating and caching an empty one on first access. */
export function getOrCreateScope(ctx: ParserContext, node: object) {
  let scope = ctx.scopeDeclarations.get(node);
  if (!scope) {
    scope = new Map();
    ctx.scopeDeclarations.set(node, scope);
  }
  return scope;
}

/** Scope bindings from `const { a, b: c } = $props()`. Destructured props are `prop`; rest is `local`. */
export function extractRunesScopeBindings(
  parser: ComponentParser,
  _node: VariableDeclaration,
  declarator: VariableDeclarator,
) {
  const bindings: Array<{ kind: ScopeBindingKind; name: string; publicPropName?: string }> = [];

  if (declarator.id.type === "Identifier") {
    bindings.push({ kind: "local", name: declarator.id.name });
    return bindings;
  }

  if (declarator.id.type !== "ObjectPattern") {
    return bindings;
  }

  for (const property of declarator.id.properties) {
    if (property.type === "RestElement") {
      if (property.argument.type === "Identifier") {
        bindings.push({ kind: "local", name: property.argument.name });
      }
      continue;
    }

    if (property.computed) continue;

    const propName = parser.getPropertyName(property.key);
    if (!propName) continue;

    let localName: string | undefined;

    if (property.value.type === "Identifier") {
      localName = property.value.name;
    } else if (property.value.type === "AssignmentPattern" && property.value.left.type === "Identifier") {
      localName = property.value.left.name;
    }

    if (!localName) continue;

    bindings.push({ kind: "prop", name: localName, publicPropName: propName });
  }

  return bindings;
}

/** Declares bindings for every declarator in a `var`/`let`/`const` declaration into the appropriate scope. */
export function declareVariableDeclaration(
  parser: ComponentParser,
  declaration: unknown,
  lexicalScope: LexicalScope,
  varScope: LexicalScope,
  options?: { allowRunesProps?: boolean; forceProp?: boolean },
) {
  if (!isVariableDeclaration(declaration)) {
    return;
  }

  const allowRunesProps = options?.allowRunesProps ?? false;
  const forceProp = options?.forceProp ?? false;
  const variableDeclaration = declaration;

  for (const declarator of variableDeclaration.declarations) {
    if (allowRunesProps && isCallExpressionNamed(unwrapTypeCastExpression(declarator.init), "$props")) {
      for (const binding of extractRunesScopeBindings(parser, variableDeclaration, declarator)) {
        declareScopeBinding(
          binding.kind === "prop" ? lexicalScope : varScope,
          binding.name,
          binding.kind === "prop" ? { kind: "prop", publicPropName: binding.publicPropName } : { kind: "local" },
        );
      }
      continue;
    }

    const targetScope = variableDeclaration.kind === "var" ? varScope : lexicalScope;
    const bindingKind: ScopeBindingKind = forceProp ? "prop" : "local";

    for (const identifier of collectPatternIdentifiers(declarator.id)) {
      declareScopeBinding(
        targetScope,
        identifier,
        bindingKind === "prop" ? { kind: "prop", publicPropName: identifier } : { kind: "local" },
      );
    }
  }
}

/** Declares a function-like node's own name (if any) and its parameter bindings into `scope`. */
export function declareFunctionLikeScopeBindings(
  node: FunctionExpression | ArrowFunctionExpression | FunctionDeclaration,
  scope: LexicalScope,
) {
  if ("id" in node && node.id && typeof node.id === "object" && "name" in node.id && typeof node.id.name === "string") {
    declareScopeBinding(scope, node.id.name, { kind: "local" });
  }

  for (const param of node.params) {
    for (const identifier of collectPatternIdentifiers(param)) {
      declareScopeBinding(scope, identifier, { kind: "local" });
    }
  }
}

/** Declares top-level `var`/`function`/`class` bindings directly within a block's statement list. */
export function collectDirectBlockDeclarations(
  parser: ComponentParser,
  body: unknown,
  lexicalScope: LexicalScope,
  varScope: LexicalScope,
) {
  if (!Array.isArray(body)) return;

  for (const statement of body) {
    if (!statement || typeof statement !== "object" || !("type" in statement)) continue;

    switch (statement.type) {
      case "VariableDeclaration":
        declareVariableDeclaration(parser, statement, lexicalScope, varScope);
        break;
      case "FunctionDeclaration":
        if (statement.id?.name) {
          declareScopeBinding(lexicalScope, statement.id.name, { kind: "local" });
        }
        break;
      case "ClassDeclaration":
        if (statement.id?.name) {
          declareScopeBinding(lexicalScope, statement.id.name, { kind: "local" });
        }
        break;
    }
  }
}

/** Declares all component-instance-level (`<script>`) bindings into `ctx.componentScope`. */
export function collectComponentScopeDeclarations(parser: ComponentParser, ctx: ParserContext, instance: unknown) {
  if (!instance || typeof instance !== "object") return;

  const program =
    "content" in instance &&
    instance.content &&
    typeof instance.content === "object" &&
    "body" in instance.content &&
    Array.isArray(instance.content.body)
      ? instance.content
      : "body" in instance && Array.isArray(instance.body)
        ? instance
        : undefined;

  if (!program || !("body" in program) || !Array.isArray(program.body)) return;

  for (const statement of program.body) {
    if (!statement || typeof statement !== "object" || !("type" in statement)) continue;

    switch (statement.type) {
      case "ImportDeclaration":
        for (const specifier of statement.specifiers ?? []) {
          if (specifier.local?.name) {
            declareScopeBinding(ctx.componentScope, specifier.local.name, { kind: "local" });
          }
        }
        break;
      case "VariableDeclaration":
        declareVariableDeclaration(parser, statement, ctx.componentScope, ctx.componentScope, {
          allowRunesProps: true,
        });
        break;
      case "FunctionDeclaration":
        if (statement.id?.name) {
          declareScopeBinding(ctx.componentScope, statement.id.name, { kind: "local" });
        }
        break;
      case "ClassDeclaration":
        if (statement.id?.name) {
          declareScopeBinding(ctx.componentScope, statement.id.name, { kind: "local" });
        }
        break;
      case "ExportNamedDeclaration":
        if (!statement.declaration || typeof statement.declaration !== "object" || !("type" in statement.declaration)) {
          break;
        }

        if (statement.declaration.type === "VariableDeclaration") {
          declareVariableDeclaration(parser, statement.declaration, ctx.componentScope, ctx.componentScope, {
            forceProp: true,
          });
        } else if (statement.declaration.type === "FunctionDeclaration" && statement.declaration.id?.name) {
          declareScopeBinding(ctx.componentScope, statement.declaration.id.name, {
            kind: "prop",
            publicPropName: statement.declaration.id.name,
          });
        }
        break;
    }
  }
}

/**
 * Resets `ctx.componentScope` / `ctx.scopeDeclarations` / `ctx.activeScopes` and declares the
 * top-level `<script>` bindings. Does not walk the component tree; nested scope declarations are
 * built incrementally by {@link enterNestedScopeDeclarationNode} inside the caller's own traversal
 * of `componentRoot` (fused with prop/slot/event extraction there rather than walked separately).
 */
export function initComponentScope(parser: ComponentParser, ctx: ParserContext) {
  ctx.componentScope.clear();
  ctx.scopeDeclarations = new WeakMap();
  ctx.activeScopes.length = 0;

  collectComponentScopeDeclarations(parser, ctx, ctx.parsed?.instance);
}

/** Mutable stack tracking the enclosing `var`-hoisting scope while walking `componentRoot`. */
export type ScopeWalkState = { varScopeStack: LexicalScope[] };

/** Creates the scope-walk state for a fresh traversal of `componentRoot`, seeded with `ctx.componentScope`. */
export function createScopeWalkState(ctx: ParserContext): ScopeWalkState {
  return { varScopeStack: [ctx.componentScope] };
}

/**
 * Per-node `enter` step of the (formerly standalone) nested-scope-declaration walk. Declares
 * bindings for `node` if it's a scope owner and pushes it as the active `var` scope for its
 * descendants. Must be called during the same top-down traversal of `componentRoot` that
 * {@link leaveNestedScopeDeclarationNode} tears down, and before any logic that reads
 * `ctx.scopeDeclarations` for `node` itself (its own scope is only created here, on entry).
 */
export function enterNestedScopeDeclarationNode(
  parser: ComponentParser,
  ctx: ParserContext,
  state: ScopeWalkState,
  node: unknown,
) {
  if (!isScopeOwner(node)) return;

  const scope = getOrCreateScope(ctx, node as unknown as object);
  const currentVarScope = state.varScopeStack[state.varScopeStack.length - 1] ?? ctx.componentScope;
  const nodeType = String((node as { type: string }).type);

  switch (nodeType) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      declareFunctionLikeScopeBindings(
        node as FunctionExpression | ArrowFunctionExpression | FunctionDeclaration,
        scope,
      );
      break;
    case "BlockStatement":
      collectDirectBlockDeclarations(parser, (node as { body?: unknown }).body, scope, currentVarScope);
      break;
    case "CatchClause":
      if ("param" in (node as object)) {
        for (const identifier of collectPatternIdentifiers((node as { param?: Pattern }).param)) {
          declareScopeBinding(scope, identifier, { kind: "local" });
        }
      }
      break;
    case "EachBlock": {
      const eachBlock = node as { context?: Pattern; index?: Identifier | string };
      for (const identifier of collectPatternIdentifiers(eachBlock.context)) {
        declareScopeBinding(scope, identifier, { kind: "local" });
      }
      if (typeof eachBlock.index === "string") {
        declareScopeBinding(scope, eachBlock.index, { kind: "local" });
      } else if (eachBlock.index && "name" in eachBlock.index) {
        declareScopeBinding(scope, eachBlock.index.name, { kind: "local" });
      }
      break;
    }
    case "ThenBlock":
      if ("value" in (node as object)) {
        for (const identifier of collectPatternIdentifiers((node as { value?: Pattern }).value)) {
          declareScopeBinding(scope, identifier, { kind: "local" });
        }
      }
      break;
    case "CatchBlock":
      if ("error" in (node as object)) {
        for (const identifier of collectPatternIdentifiers((node as { error?: Pattern }).error)) {
          declareScopeBinding(scope, identifier, { kind: "local" });
        }
      }
      break;
  }

  if (isFunctionScopeOwner(node)) {
    state.varScopeStack.push(scope);
  }
}

/** Per-node `leave` step counterpart to {@link enterNestedScopeDeclarationNode}. */
export function leaveNestedScopeDeclarationNode(state: ScopeWalkState, node: unknown) {
  if (isFunctionScopeOwner(node)) {
    state.varScopeStack.pop();
  }
}
