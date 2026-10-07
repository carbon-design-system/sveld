import type { AST, Program } from "sveast";
import { isReference, SKIP, STOP, walk } from "sveast/walk";
import type { SyntaxMode } from "../model";
import type { ParserContext } from "./context";
import { collectPatternIdentifiers, isScopeOwner } from "./scopes";
import { isTypeOnlySubtree } from "./walk";

/** Dotted forms (`$state.raw`) are a `MemberExpression` whose object is one of these, a reference too. */
const RUNE_NAMES = new Set(["$state", "$derived", "$effect", "$props", "$bindable", "$inspect", "$host"]);

const RUNE_NAME_LIST = Array.from(RUNE_NAMES);

/** ASCII `[A-Za-z0-9_$]`: a rune name touching one of these is part of a longer identifier (e.g. `$$props`). */
function isAsciiIdentifierChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95 /* _ */ ||
    code === 36 /* $ */
  );
}

/**
 * Textual pre-check: false only when no rune name appears as a standalone
 * token and no `\u` escape could spell one. A false positive (a rune name in
 * a string or comment) just falls back to the walk.
 */
function mayContainRuneReference(source: string): boolean {
  if (source.includes("\\u")) return true;
  for (const name of RUNE_NAME_LIST) {
    let index = source.indexOf(name);
    while (index !== -1) {
      // `charCodeAt(-1)` / past-the-end is NaN, which counts as a boundary.
      if (
        !isAsciiIdentifierChar(source.charCodeAt(index - 1)) &&
        !isAsciiIdentifierChar(source.charCodeAt(index + name.length))
      ) {
        return true;
      }
      index = source.indexOf(name, index + 1);
    }
  }
  return false;
}

type ScopeStack = Array<Set<string>>;

function isShadowed(name: string, scopeStack: ScopeStack): boolean {
  for (let i = scopeStack.length - 1; i >= 0; i -= 1) {
    if (scopeStack[i]?.has(name)) return true;
  }
  return false;
}

/** The identifiers a scope-owning node introduces directly (not through nested scopes). */
function collectScopeOwnerNames(node: AST.SvelteNode): Set<string> {
  const names = new Set<string>();
  switch (node.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      if (node.type !== "ArrowFunctionExpression" && node.id) names.add(node.id.name);
      for (const param of node.params) collectPatternIdentifiers(param, names);
      break;
    case "BlockStatement":
      collectDirectBlockNames(node.body, names);
      break;
    case "CatchClause":
      collectPatternIdentifiers(node.param, names);
      break;
    case "EachBlock":
      collectPatternIdentifiers(node.context, names);
      if (node.index) names.add(node.index);
      break;
    case "AwaitBlock":
      collectPatternIdentifiers(node.value, names);
      collectPatternIdentifiers(node.error, names);
      break;
  }
  return names;
}

/** Top-level `import`/`var`/`function`/`class` bindings directly within a statement list. */
function collectDirectBlockNames(body: Program["body"] | undefined, names: Set<string>) {
  for (const statement of body ?? []) {
    switch (statement.type) {
      case "ImportDeclaration":
        for (const specifier of statement.specifiers) names.add(specifier.local.name);
        break;
      case "VariableDeclaration":
        for (const declarator of statement.declarations) collectPatternIdentifiers(declarator.id, names);
        break;
      case "FunctionDeclaration":
      case "ClassDeclaration":
        if (statement.id?.name) names.add(statement.id.name);
        break;
      case "ExportNamedDeclaration":
        if (statement.declaration) collectDirectBlockNames([statement.declaration], names);
        break;
    }
  }
}

/** True if `root` contains an unshadowed rune reference; the first one ends the walk. */
function scanForRuneReference(root: AST.SvelteNode | undefined, baseScope: ScopeStack): boolean {
  if (!root) return false;
  const scopeStack = [...baseScope];
  let found = false;
  walk(root, {
    enter(node, parent) {
      // Type-level TS subtrees hold no value references.
      if (isTypeOnlySubtree(node.type)) return SKIP;
      if (isScopeOwner(node)) scopeStack.push(collectScopeOwnerNames(node));
      if (
        node.type === "Identifier" &&
        RUNE_NAMES.has(node.name) &&
        isReference(node, parent) &&
        !isShadowed(node.name, scopeStack)
      ) {
        found = true;
        return STOP;
      }
    },
    leave(node) {
      if (isScopeOwner(node)) scopeStack.pop();
    },
  });
  return found;
}

/**
 * Mirrors svelte's `analyze_component`: `<svelte:options runes={...} />` wins;
 * otherwise runes mode if any rune name is referenced unshadowed in the module
 * script, instance script, or template. Omitted: top-level `await` forcing runes.
 */
export function detectSyntaxMode(ctx: ParserContext): SyntaxMode {
  if (ctx.runesOptionOverride !== undefined) {
    return ctx.runesOptionOverride ? "runes" : "legacy";
  }

  const root = ctx.parsed;
  if (!root) return "legacy";

  // Skips three full AST walks for most legacy components.
  if (ctx.source !== undefined && !mayContainRuneReference(ctx.source)) return "legacy";

  const moduleScope = new Set<string>();
  collectDirectBlockNames(root.module?.content.body, moduleScope);

  const instanceScope = new Set<string>();
  collectDirectBlockNames(root.instance?.content.body, instanceScope);

  const runes =
    scanForRuneReference(root.module, [moduleScope]) ||
    scanForRuneReference(root.instance, [moduleScope, instanceScope]) ||
    scanForRuneReference(root.fragment, [moduleScope, instanceScope]);

  return runes ? "runes" : "legacy";
}
