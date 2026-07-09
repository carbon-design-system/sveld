import type { Pattern } from "estree";
import type { Node } from "estree-walker";
import { walk } from "estree-walker";
import type { SyntaxMode } from "../ComponentParser";
import type { ParserContext } from "./context";
import { collectPatternIdentifiers, isScopeOwner } from "./scopes";

/**
 * Bare rune identifiers as they appear in `scope.references` keys. Dotted forms like `$state.raw`
 * or `$derived.by` never occur as an `Identifier.name` - they're a `MemberExpression` whose
 * `.object` is the bare identifier, which `isValueReference` below already resolves correctly.
 */
const RUNE_NAMES = new Set(["$state", "$derived", "$effect", "$props", "$bindable", "$inspect", "$host"]);

/**
 * True if `node` (an `Identifier`) is used as a value reference rather than a non-reference
 * position - a member-expression property (`foo.$state`), an object-literal key (`{ $state: 1 }`),
 * or an import/export rename target. Ported from the `is-reference` package (same helper svelte's
 * own analyzer uses, github.com/Rich-Harris/is-reference) rather than taken on as a dependency for
 * one ~15-line function.
 */
function isValueReference(node: { type: string }, parent: { type: string } | undefined): boolean {
  switch (parent?.type) {
    // disregard `bar` in `foo.bar`
    case "MemberExpression":
      return (
        (parent as { computed?: boolean; object?: unknown }).computed ||
        node === (parent as { object?: unknown }).object
      );
    // disregard the `foo` in `class {foo(){}}` but keep it in `class {[foo](){}}`
    case "MethodDefinition":
      return !!(parent as { computed?: boolean }).computed;
    // disregard the `meta` in `import.meta`
    case "MetaProperty":
      return node === (parent as { meta?: unknown }).meta;
    // disregard the `foo` in `class {foo=bar}` but keep it in `class {[foo]=bar}` and `class {bar=foo}`
    case "PropertyDefinition":
      return (
        (parent as { computed?: boolean; value?: unknown }).computed || node === (parent as { value?: unknown }).value
      );
    // disregard the `bar` in `{ bar: foo }`, but keep it in `{ [bar]: foo }`
    case "Property":
      return (
        (parent as { computed?: boolean; value?: unknown }).computed || node === (parent as { value?: unknown }).value
      );
    // disregard the `bar` in `export { foo as bar }` or the `foo` in `import { foo as bar }`
    case "ExportSpecifier":
    case "ImportSpecifier":
      return node === (parent as { local?: unknown }).local;
    // disregard the `foo` in `foo: while (...) { ... break foo; ... continue foo; }`
    case "LabeledStatement":
    case "BreakStatement":
    case "ContinueStatement":
      return false;
    default:
      return true;
  }
}

type ScopeStack = Array<Set<string>>;

function isShadowed(name: string, scopeStack: ScopeStack): boolean {
  for (let i = scopeStack.length - 1; i >= 0; i -= 1) {
    if (scopeStack[i]?.has(name)) return true;
  }
  return false;
}

/** Declares the identifiers a scope-owning node introduces directly (not through nested scopes). */
function collectScopeOwnerNames(node: unknown): Set<string> {
  const names = new Set<string>();
  if (!node || typeof node !== "object" || !("type" in node)) return names;

  switch (String(node.type)) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression": {
      const fn = node as { id?: { name?: string }; params?: unknown[] };
      if (fn.id?.name) names.add(fn.id.name);
      for (const param of fn.params ?? []) {
        collectPatternIdentifiers(param as Pattern, names);
      }
      break;
    }
    case "BlockStatement":
      collectDirectBlockNames((node as { body?: unknown[] }).body, names);
      break;
    case "CatchClause":
      collectPatternIdentifiers((node as { param?: Pattern | null }).param, names);
      break;
    case "EachBlock": {
      const eachBlock = node as { context?: Pattern; index?: { name?: string } | string };
      collectPatternIdentifiers(eachBlock.context, names);
      if (typeof eachBlock.index === "string") {
        names.add(eachBlock.index);
      } else if (eachBlock.index?.name) {
        names.add(eachBlock.index.name);
      }
      break;
    }
    case "ThenBlock":
      collectPatternIdentifiers((node as { value?: Pattern }).value, names);
      break;
    case "CatchBlock":
      collectPatternIdentifiers((node as { error?: Pattern }).error, names);
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

/** True if `root`'s subtree contains an unshadowed reference to a rune name. */
function scanForRuneReference(root: unknown, baseScope: ScopeStack): boolean {
  if (!root || typeof root !== "object") return false;

  const scopeStack: ScopeStack = [...baseScope];
  let found = false;

  walk(root as Node, {
    enter(node, parent) {
      if (found) {
        this.skip();
        return;
      }

      if (isScopeOwner(node)) {
        scopeStack.push(collectScopeOwnerNames(node));
      }

      if (
        parent &&
        node.type === "Identifier" &&
        RUNE_NAMES.has(node.name) &&
        !parent.type.startsWith("TS") &&
        isValueReference(node, parent) &&
        !isShadowed(node.name, scopeStack)
      ) {
        found = true;
        this.skip();
      }
    },
    leave(node) {
      if (isScopeOwner(node)) {
        scopeStack.pop();
      }
    },
  });

  return found;
}

/** Legacy AST script nodes wrap their `Program` in `.content`; mirrors the shape check in `scopes.ts`. */
function getScriptProgramBody(script: unknown): unknown[] | undefined {
  if (!script || typeof script !== "object") return undefined;

  if ("content" in script) {
    const content = (script as { content?: unknown }).content;
    const body =
      content && typeof content === "object" && "body" in content ? (content as { body?: unknown }).body : undefined;
    if (Array.isArray(body)) return body;
  }

  if ("body" in script && Array.isArray((script as { body?: unknown }).body)) {
    return (script as { body: unknown[] }).body;
  }

  return undefined;
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

  const moduleScope = new Set<string>();
  collectDirectBlockNames(getScriptProgramBody(root.module), moduleScope);

  const instanceScope = new Set<string>();
  collectDirectBlockNames(getScriptProgramBody(root.instance), instanceScope);

  const runes =
    scanForRuneReference(root.module, [moduleScope]) ||
    scanForRuneReference(root.instance, [moduleScope, instanceScope]) ||
    scanForRuneReference(root.html, [moduleScope, instanceScope]);

  return runes ? "runes" : "legacy";
}
