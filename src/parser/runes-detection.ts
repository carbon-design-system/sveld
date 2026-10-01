import type { AST, Pattern } from "sveast";
import { isReference, SKIP, STOP, walk } from "sveast/walk";
import type { SyntaxMode } from "../model";
import type { ParserContext } from "./context";
import { collectPatternIdentifiers, isScopeOwner } from "./scopes";
import { isTypeOnlySubtree } from "./walk";

/**
 * Bare rune identifiers as they appear in `scope.references` keys. Dotted forms like `$state.raw`
 * or `$derived.by` never occur as an `Identifier.name` - they're a `MemberExpression` whose
 * `.object` is the bare identifier, which `isReference` counts as a reference.
 */
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
 * Cheap textual pre-check: false only when no rune name appears in `source`
 * as a standalone token (not glued to other ASCII identifier characters, as
 * in `$$props`), and no `\u` escape could be spelling one. Any other case,
 * including a rune name inside a string or comment, falls back to the walk.
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

/** Declares the identifiers a scope-owning node introduces directly (not through nested scopes). */
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

/** Declares top-level `import`/`var`/`function`/`class` bindings directly within a statement list. */
function collectDirectBlockNames(body: unknown, names: Set<string>) {
  if (!Array.isArray(body)) return;

  for (const statement of body) {
    if (!statement || typeof statement !== "object" || !("type" in statement)) continue;

    switch (String(statement.type)) {
      case "ImportDeclaration":
        for (const specifier of (statement as { specifiers?: Array<{ local?: { name?: string } }> }).specifiers ?? []) {
          if (specifier.local?.name) names.add(specifier.local.name);
        }
        break;
      case "VariableDeclaration":
        for (const declarator of (statement as { declarations?: Array<{ id?: Pattern }> }).declarations ?? []) {
          collectPatternIdentifiers(declarator.id, names);
        }
        break;
      case "FunctionDeclaration":
      case "ClassDeclaration": {
        const name = (statement as { id?: { name?: string } }).id?.name;
        if (name) names.add(name);
        break;
      }
      case "ExportNamedDeclaration": {
        const declaration = (statement as { declaration?: unknown }).declaration;
        if (declaration && typeof declaration === "object" && "type" in declaration) {
          collectDirectBlockNames([declaration], names);
        }
        break;
      }
    }
  }
}

/**
 * True if `root`'s subtree contains an unshadowed reference to a rune name.
 * The first one ends the walk, which for a runes component is usually within
 * the first few statements.
 */
function scanForRuneReference(root: AST.SvelteNode | undefined, baseScope: ScopeStack): boolean {
  if (!root) return false;
  const scopeStack = [...baseScope];
  let found = false;
  walk(root, {
    enter(node, parent) {
      // Type-level TS subtrees hold no value references (svelte strips them
      // before its own analysis; every identifier under one has a TS parent,
      // which the check below rejects anyway), so don't descend into them.
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
 * Determines a component's syntax mode without running the svelte compiler's analyze phase.
 *
 * Mirrors `analyze_component`'s own logic (`node_modules/svelte/src/compiler/phases/2-analyze/index.js`):
 * an explicit `<svelte:options runes={...} />` always wins; otherwise the component is in runes
 * mode if any rune name is referenced - and not shadowed by a local declaration of the same name -
 * anywhere in the module script, instance script, or template.
 *
 * Mirrors svelte analyze runes detection. Omitted: top-level `await` forces runes (no fixture).
 */
export function detectSyntaxMode(ctx: ParserContext): SyntaxMode {
  if (ctx.runesOptionOverride !== undefined) {
    return ctx.runesOptionOverride ? "runes" : "legacy";
  }

  const root = ctx.parsed;
  if (!root) return "legacy";

  // An `Identifier` named `$state` etc. can only come from that text in the
  // source, so a component whose text has no rune name can't be in runes
  // mode. Skips three full AST walks for every legacy component. (A `\u`
  // escape could spell a rune name without the literal substring, so fall
  // back to the walk when one is present.)
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
