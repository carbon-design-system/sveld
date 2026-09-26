import type {
  ArrowFunctionExpression,
  BlockStatement,
  CatchClause,
  ExportSpecifier,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Pattern,
  VariableDeclarator,
} from "estree";
import type { AST } from "svelte/compiler";
import {
  getPropertyName,
  isCallExpressionNamed,
  isIdentifier,
  isMemberExpression,
  isVariableDeclaration,
  unwrapTypeCastExpression,
} from "../ast-guards";
import type { LexicalScope, ScopeBinding, ScopeBindingKind } from "../model";
import type { ParserContext } from "./context";

function declareScopeBinding(scope: LexicalScope, name: string, binding: ScopeBinding) {
  if (!name || scope.has(name)) return;
  scope.set(name, binding);
}

export function resolveIdentifierToReactiveProp(ctx: ParserContext, name: string) {
  for (let i = ctx.activeScopes.length - 1; i >= 0; i -= 1) {
    const binding = ctx.activeScopes[i]?.get(name);
    if (!binding) continue;
    return binding.kind === "prop" ? binding.publicPropName : undefined;
  }

  return undefined;
}

/**
 * True when `name` is bound by a function, block, or template scope around the
 * current walk position, so it isn't the script's top-level binding of that
 * name (an import, say): `function register(KEY) { setContext(KEY, ...) }`.
 */
export function isBoundInNestedScope(ctx: ParserContext, name: string): boolean {
  for (let i = ctx.activeScopes.length - 1; i >= 0; i -= 1) {
    const scope = ctx.activeScopes[i];
    if (scope === ctx.componentScope) return false;
    if (scope?.has(name)) return true;
  }
  return false;
}

/** {@link isBoundInNestedScope} for the identifier a callee starts with (`helper`, or `h` in `h.fn`). */
export function isCalleeBoundInNestedScope(ctx: ParserContext, callee: unknown): boolean {
  let node = callee;
  while (isMemberExpression(node)) node = node.object;
  return isIdentifier(node) && isBoundInNestedScope(ctx, node.name);
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
  if (!target || typeof target !== "object" || !("type" in target)) return;

  // `x = ...` / `x++`: by far the most common target; skip the Set allocation.
  if (target.type === "Identifier") {
    const publicPropName = resolveIdentifierToReactiveProp(ctx, target.name);
    if (publicPropName) {
      ctx.reactive_vars.add(publicPropName);
    }
    return;
  }

  const identifiers = collectPatternIdentifiers(target);

  for (const identifier of identifiers) {
    const publicPropName = resolveIdentifierToReactiveProp(ctx, identifier);
    if (publicPropName) {
      ctx.reactive_vars.add(publicPropName);
    }
  }
}

/** A node {@link isScopeOwner} accepts. */
type ScopeOwnerNode =
  | BlockStatement
  | FunctionDeclaration
  | FunctionExpression
  | ArrowFunctionExpression
  | CatchClause
  | AST.EachBlock
  | AST.AwaitBlock;

/**
 * True for node types that introduce a new lexical scope.
 *
 * Modern AST puts `{:then}` / `{:catch}` bindings on `AwaitBlock` itself,
 * not on separate `ThenBlock`/`CatchBlock` children. Both patterns share
 * one AwaitBlock-wide scope. Walking `pending` or `catch` will see the
 * `then` binding too. That only bites if someone names an await binding
 * the same as a prop and relies on cross-branch shadowing. Not worth
 * three scope objects for one block.
 */
export function isScopeOwner(node: unknown): node is ScopeOwnerNode {
  if (!node || typeof node !== "object" || !("type" in node)) return false;

  switch (String(node.type)) {
    case "BlockStatement":
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
    case "CatchClause":
    case "EachBlock":
    case "AwaitBlock":
      return true;
    default:
      return false;
  }
}

/** True for node types that introduce a new `var`-hoisting (function) scope. */
function isFunctionScopeOwner(node: unknown) {
  if (!node || typeof node !== "object" || !("type" in node)) return false;
  const type = String(node.type);
  return type === "FunctionDeclaration" || type === "FunctionExpression" || type === "ArrowFunctionExpression";
}

/** Returns the scope map for `node`, creating and caching an empty one on first access. */
function getOrCreateScope(ctx: ParserContext, node: object) {
  let scope = ctx.scopeDeclarations.get(node);
  if (!scope) {
    scope = new Map();
    ctx.scopeDeclarations.set(node, scope);
  }
  return scope;
}

/** Scope bindings from `const { a, b: c } = $props()`. Destructured props are `prop`; rest is `local`. */
function extractRunesScopeBindings(declarator: VariableDeclarator) {
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

    const propName = getPropertyName(property.key);
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
function declareVariableDeclaration(
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
      for (const binding of extractRunesScopeBindings(declarator)) {
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
function declareFunctionLikeScopeBindings(
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
function collectDirectBlockDeclarations(body: unknown, lexicalScope: LexicalScope, varScope: LexicalScope) {
  if (!Array.isArray(body)) return;

  for (const statement of body) {
    if (!statement || typeof statement !== "object" || !("type" in statement)) continue;

    switch (statement.type) {
      case "VariableDeclaration":
        declareVariableDeclaration(statement, lexicalScope, varScope);
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

/**
 * `export { local as name }` makes `local` the `name` prop, so assigning `local`
 * marks `name` reactive. Replaces the `local` binding its declaration made, if
 * any; one declared after the export keeps this binding (see `declareScopeBinding`).
 */
function declareExportSpecifierProps(ctx: ParserContext, specifiers: ExportSpecifier[]) {
  for (const { local, exported } of specifiers) {
    if (local.type !== "Identifier") continue;
    const publicPropName = exported.type === "Identifier" ? exported.name : String(exported.value);
    if (ctx.componentScope.get(local.name)?.kind === "prop") continue;
    ctx.componentScope.set(local.name, { kind: "prop", publicPropName });
  }
}

/** Declares all component-instance-level (`<script>`) bindings into `ctx.componentScope`. */
function collectComponentScopeDeclarations(ctx: ParserContext, instance: AST.Script | undefined) {
  for (const statement of instance?.content.body ?? []) {
    switch (statement.type) {
      case "ImportDeclaration":
        for (const specifier of statement.specifiers) {
          if (specifier.local.name) {
            declareScopeBinding(ctx.componentScope, specifier.local.name, { kind: "local" });
          }
        }
        break;
      case "VariableDeclaration":
        declareVariableDeclaration(statement, ctx.componentScope, ctx.componentScope, {
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
        if (!statement.declaration) {
          if (statement.source == null) declareExportSpecifierProps(ctx, statement.specifiers);
          break;
        }

        if (statement.declaration.type === "VariableDeclaration") {
          declareVariableDeclaration(statement.declaration, ctx.componentScope, ctx.componentScope, {
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
export function initComponentScope(ctx: ParserContext) {
  ctx.componentScope.clear();
  ctx.scopeDeclarations = new Map();
  ctx.activeScopes.length = 0;

  collectComponentScopeDeclarations(ctx, ctx.parsed?.instance);
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
  ctx: ParserContext,
  state: ScopeWalkState,
  node: unknown,
): LexicalScope | undefined {
  if (!isScopeOwner(node)) return undefined;

  const scope = getOrCreateScope(ctx, node);
  const currentVarScope = state.varScopeStack[state.varScopeStack.length - 1] ?? ctx.componentScope;

  switch (node.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      declareFunctionLikeScopeBindings(node, scope);
      break;
    case "BlockStatement":
      collectDirectBlockDeclarations(node.body, scope, currentVarScope);
      break;
    case "CatchClause":
      for (const identifier of collectPatternIdentifiers(node.param)) {
        declareScopeBinding(scope, identifier, { kind: "local" });
      }
      break;
    case "EachBlock":
      for (const identifier of collectPatternIdentifiers(node.context)) {
        declareScopeBinding(scope, identifier, { kind: "local" });
      }
      if (typeof node.index === "string") {
        declareScopeBinding(scope, node.index, { kind: "local" });
      }
      break;
    case "AwaitBlock":
      for (const identifier of collectPatternIdentifiers(node.value)) {
        declareScopeBinding(scope, identifier, { kind: "local" });
      }
      for (const identifier of collectPatternIdentifiers(node.error)) {
        declareScopeBinding(scope, identifier, { kind: "local" });
      }
      break;
  }

  if (isFunctionScopeOwner(node)) {
    state.varScopeStack.push(scope);
  }

  return scope;
}

/** Per-node `leave` step counterpart to {@link enterNestedScopeDeclarationNode}. */
export function leaveNestedScopeDeclarationNode(state: ScopeWalkState, node: unknown) {
  if (isFunctionScopeOwner(node)) {
    state.varScopeStack.pop();
  }
}
