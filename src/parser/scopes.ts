import type {
  ArrowFunctionExpression,
  AST,
  BlockStatement,
  CatchClause,
  ExportSpecifier,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Pattern,
  Program,
  VariableDeclaration,
  VariableDeclarator,
} from "svelte-ast";
import { extractIdentifiers } from "svelte-ast/walk";
import { getPropertyName, isCallExpressionNamed, isIdentifier, isMemberExpression } from "../ast-guards";
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

// A name bound by a function, block, or template scope around the walk
// isn't the script's top-level binding (an import,
// say): `function register(KEY) { setContext(KEY, ...) }`.
export function isBoundInNestedScope(ctx: ParserContext, name: string): boolean {
  for (let i = ctx.activeScopes.length - 1; i >= 0; i -= 1) {
    const scope = ctx.activeScopes[i];
    if (scope === ctx.componentScope) return false;
    if (scope?.has(name)) return true;
  }
  return false;
}

export function isCalleeBoundInNestedScope(ctx: ParserContext, callee: unknown): boolean {
  let node = callee;
  while (isMemberExpression(node)) node = node.object;
  return isIdentifier(node) && isBoundInNestedScope(ctx, node.name);
}

export function collectPatternIdentifiers(
  target: Parameters<typeof extractIdentifiers>[0] | null | undefined,
  names: Set<string> = new Set(),
) {
  if (target) {
    for (const identifier of extractIdentifiers(target)) names.add(identifier.name);
  }
  return names;
}

export function markReactivePropsFromMutationTarget(
  ctx: ParserContext,
  target: Pattern | Expression | null | undefined,
) {
  if (!target || typeof target !== "object" || !("type" in target)) return;

  // `x = ...` / `x++`: by far the most common target; skip the
  // Set allocation.
  if (target.type === "Identifier") {
    const publicPropName = resolveIdentifierToReactiveProp(ctx, target.name);
    if (publicPropName) {
      ctx.reactive_vars.add(publicPropName);
    }
    return;
  }

  // A member expression target (`x.y = ...`) binds nothing.
  if (target.type !== "ObjectPattern" && target.type !== "ArrayPattern") return;

  for (const identifier of collectPatternIdentifiers(target)) {
    const publicPropName = resolveIdentifierToReactiveProp(ctx, identifier);
    if (publicPropName) {
      ctx.reactive_vars.add(publicPropName);
    }
  }
}

export type ScopeOwnerNode =
  | BlockStatement
  | FunctionDeclaration
  | FunctionExpression
  | ArrowFunctionExpression
  | CatchClause
  | AST.EachBlock
  | AST.AwaitBlock;

// `{:then}` and `{:catch}` bindings share one AwaitBlock-wide scope, so
// every branch sees both; only cross-branch shadowing of a prop name
// would notice.
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

function isFunctionScopeOwner(node: unknown) {
  if (!node || typeof node !== "object" || !("type" in node)) return false;
  const type = String(node.type);
  return type === "FunctionDeclaration" || type === "FunctionExpression" || type === "ArrowFunctionExpression";
}

// Only destructured props are `prop`; the rest element is `local`.
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

    const target = property.value.type === "AssignmentPattern" ? property.value.left : property.value;
    if (target.type !== "Identifier" || !target.name) continue;

    bindings.push({ kind: "prop", name: target.name, publicPropName: propName });
  }

  return bindings;
}

function declareVariableDeclaration(
  declaration: VariableDeclaration,
  lexicalScope: LexicalScope,
  varScope: LexicalScope,
  options?: { allowRunesProps?: boolean; forceProp?: boolean },
) {
  const targetScope = declaration.kind === "var" ? varScope : lexicalScope;

  for (const declarator of declaration.declarations) {
    if (options?.allowRunesProps && isCallExpressionNamed(declarator.init, "$props")) {
      for (const binding of extractRunesScopeBindings(declarator)) {
        declareScopeBinding(
          binding.kind === "prop" ? lexicalScope : varScope,
          binding.name,
          binding.kind === "prop" ? { kind: "prop", publicPropName: binding.publicPropName } : { kind: "local" },
        );
      }
      continue;
    }

    for (const identifier of collectPatternIdentifiers(declarator.id)) {
      declareScopeBinding(
        targetScope,
        identifier,
        options?.forceProp ? { kind: "prop", publicPropName: identifier } : { kind: "local" },
      );
    }
  }
}

function declareLocals(scope: LexicalScope, ...patterns: Array<Parameters<typeof collectPatternIdentifiers>[0]>) {
  for (const pattern of patterns) {
    for (const identifier of collectPatternIdentifiers(pattern)) {
      declareScopeBinding(scope, identifier, { kind: "local" });
    }
  }
}

function declareStatement(
  statement: Program["body"][number],
  lexicalScope: LexicalScope,
  varScope: LexicalScope,
  options?: { allowRunesProps?: boolean },
) {
  switch (statement.type) {
    case "VariableDeclaration":
      declareVariableDeclaration(statement, lexicalScope, varScope, options);
      break;
    case "FunctionDeclaration":
    case "ClassDeclaration":
      declareLocals(lexicalScope, statement.id);
      break;
    case "BlockStatement":
    case "BreakStatement":
    case "ContinueStatement":
    case "DebuggerStatement":
    case "DoWhileStatement":
    case "EmptyStatement":
    case "ExportAllDeclaration":
    case "ExportDefaultDeclaration":
    case "ExportNamedDeclaration":
    case "ExpressionStatement":
    case "ForInStatement":
    case "ForOfStatement":
    case "ForStatement":
    case "IfStatement":
    case "ImportDeclaration":
    case "LabeledStatement":
    case "ReturnStatement":
    case "StaticBlock":
    case "SwitchStatement":
    case "ThrowStatement":
    case "TryStatement":
    case "TSDeclareFunction":
    case "TSEnumDeclaration":
    case "TSExportAssignment":
    case "TSImportEqualsDeclaration":
    case "TSInterfaceDeclaration":
    case "TSModuleDeclaration":
    case "TSNamespaceExportDeclaration":
    case "TSTypeAliasDeclaration":
    case "WhileStatement":
    case "WithStatement":
      break;
  }
}

// `export { local as name }` makes `local` the `name` prop, so
// assigning `local` marks `name` reactive. This replaces the binding
// `local`'s declaration made, and a declaration after the export keeps
// it (see `declareScopeBinding`).
function declareExportSpecifierProps(ctx: ParserContext, specifiers: ExportSpecifier[]) {
  for (const { local, exported } of specifiers) {
    if (local.type !== "Identifier") continue;
    const publicPropName = exported.type === "Identifier" ? exported.name : String(exported.value);
    if (ctx.componentScope.get(local.name)?.kind === "prop") continue;
    ctx.componentScope.set(local.name, { kind: "prop", publicPropName });
  }
}

function collectComponentScopeDeclarations(ctx: ParserContext, instance: AST.Script | undefined) {
  const scope = ctx.componentScope;
  for (const statement of instance?.content.body ?? []) {
    if (statement.type === "ImportDeclaration") {
      declareLocals(scope, ...statement.specifiers.map((specifier) => specifier.local));
    } else if (statement.type !== "ExportNamedDeclaration") {
      declareStatement(statement, scope, scope, { allowRunesProps: true });
    } else if (!statement.declaration) {
      if (statement.source == null) declareExportSpecifierProps(ctx, statement.specifiers);
    } else if (statement.declaration.type === "VariableDeclaration") {
      declareVariableDeclaration(statement.declaration, scope, scope, { forceProp: true });
    } else if (statement.declaration.type === "FunctionDeclaration" && statement.declaration.id?.name) {
      const { name } = statement.declaration.id;
      declareScopeBinding(scope, name, { kind: "prop", publicPropName: name });
    }
  }
}

// Only the top-level bindings; nested scopes are built by
// `enterNestedScopeDeclarationNode` during the caller's walk.
export function initComponentScope(ctx: ParserContext) {
  ctx.componentScope.clear();
  ctx.activeScopes.length = 0;

  collectComponentScopeDeclarations(ctx, ctx.parsed?.instance);
}

/**
 * Mutable stack tracking the enclosing `var`-hoisting scope during the
 * component walk.
 */
export type ScopeWalkState = { varScopeStack: LexicalScope[] };

export function createScopeWalkState(ctx: ParserContext): ScopeWalkState {
  return { varScopeStack: [ctx.componentScope] };
}

export function enterNestedScopeDeclarationNode(
  ctx: ParserContext,
  state: ScopeWalkState,
  node: unknown,
): LexicalScope | undefined {
  if (!isScopeOwner(node)) return undefined;

  const scope: LexicalScope = new Map();
  const currentVarScope = state.varScopeStack[state.varScopeStack.length - 1] ?? ctx.componentScope;

  switch (node.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      // `constructor(private x)`: the parameter is wrapped.
      declareLocals(
        scope,
        node.id,
        ...node.params.map((param) => (param.type === "TSParameterProperty" ? param.parameter : param)),
      );
      break;
    case "BlockStatement":
      for (const statement of node.body) declareStatement(statement, scope, currentVarScope);
      break;
    case "CatchClause":
      declareLocals(scope, node.param);
      break;
    case "EachBlock":
      declareLocals(scope, node.context);
      if (typeof node.index === "string") declareScopeBinding(scope, node.index, { kind: "local" });
      break;
    case "AwaitBlock":
      declareLocals(scope, node.value, node.error);
      break;
  }

  if (isFunctionScopeOwner(node)) {
    state.varScopeStack.push(scope);
  }

  return scope;
}

export function leaveNestedScopeDeclarationNode(state: ScopeWalkState, node: unknown) {
  if (isFunctionScopeOwner(node)) {
    state.varScopeStack.pop();
  }
}
