/**
 * A pruned reimplementation of `svelte/compiler`'s `parse` export and `VERSION`
 * constant, built by importing only the parser phase directly instead of the
 * public `svelte/compiler` entry point.
 *
 * `svelte/compiler` is a single module that, alongside `parse`, unconditionally
 * imports the analyze and transform phases (needed for `compile`, which sveld
 * doesn't use). Neither svelte, `aria-query`, nor `axobject-query` declare
 * `"sideEffects": false`, so a bundler can't prove those phases are safe to
 * drop even when their exports go unused - importing anything at all from
 * `svelte/compiler` pulls in the full accessibility-linting dependency graph
 * (aria-query's and axobject-query's role tables), which accounts for most of
 * that module's size. Reimplementing the ~15-line public wrapper here against
 * only the parser phase's internals avoids that graph entirely.
 *
 * This depends on undocumented internal svelte paths that aren't part of its
 * public API surface (`package.json#exports` only exposes `svelte/compiler`
 * as a whole). `tests/svelte-parse-shim.test.ts` guards against drift: it
 * byte-compares this module's `parse` output against the real
 * `svelte/compiler`'s across every fixture, so a svelte upgrade that changes
 * this internal shape fails CI instead of silently shipping wrong output.
 */
// @ts-expect-error - internal svelte module, no published types
import { convert } from "../node_modules/svelte/src/compiler/legacy.js";
// @ts-expect-error - internal svelte module, no published types
import { parse as parseFragment } from "../node_modules/svelte/src/compiler/phases/1-parse/index.js";
// @ts-expect-error - internal svelte module, no published types
import { reset as resetCompilerState } from "../node_modules/svelte/src/compiler/state.js";

/**
 * The pre-strip AST shape svelte's parser produces internally, before `metadata` (an
 * implementation detail not part of svelte's public `AST.SvelteNode` types) is removed.
 * `[key: string]: unknown` keeps this assignable from real parser output without `any`,
 * and satisfies zimmerframe's `T extends { type: string }` walk constraint.
 */
interface InternalAstNode {
  type: string;
  metadata?: unknown;
  [key: string]: unknown;
}

interface InternalAstRoot extends InternalAstNode {
  options?: {
    attributes?: Array<InternalAstNode & { value?: InternalAstNode | InternalAstNode[] }>;
  };
}

function removeByteOrderMark(source: string): string {
  return source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
}

function stripMetadata(node: InternalAstNode): void {
  // biome-ignore lint/performance/noDelete: mirrors upstream svelte, which removes (not nulls) the property
  delete node.metadata;
}

/**
 * Recursively strips `metadata` from every AST node reachable from `node`.
 *
 * Mirrors zimmerframe's `walk()` traversal rule: a value is only visited (and
 * only has its own children recursed into) when it's an object carrying a
 * `type` string. A child without `type` is left alone and its descendants
 * are not visited, even if they themselves carry `type` - this is why
 * `toPublicAst` below special-cases `ast.options.attributes` before calling
 * this, since `options` itself has no `type`.
 */
function stripMetadataDeep(node: unknown): void {
  if (!node || typeof node !== "object" || typeof (node as InternalAstNode).type !== "string") return;
  stripMetadata(node as InternalAstNode);

  for (const key in node as InternalAstNode) {
    if (key === "type") continue;
    const child = (node as Record<string, unknown>)[key];
    if (!child || typeof child !== "object") continue;
    if (Array.isArray(child)) {
      for (const item of child) stripMetadataDeep(item);
    } else {
      stripMetadataDeep(child);
    }
  }
}

/** Mirrors `svelte/compiler`'s own internal `to_public_ast`. */
function toPublicAst(source: string, ast: InternalAstRoot, modern: boolean | undefined): unknown {
  if (modern) {
    for (const attribute of ast.options?.attributes ?? []) {
      stripMetadata(attribute);
      if (attribute.value) {
        for (const value of Array.isArray(attribute.value) ? attribute.value : [attribute.value]) {
          stripMetadata(value);
        }
      }
    }

    stripMetadataDeep(ast);
    return ast;
  }

  return convert(source, ast);
}

export function parse(source: string, { modern, loose }: { modern?: boolean; loose?: boolean } = {}): unknown {
  const cleaned = removeByteOrderMark(source);
  resetCompilerState({ warning: () => false, filename: undefined });
  const ast: InternalAstRoot = parseFragment(cleaned, loose);
  return toPublicAst(cleaned, ast, modern);
}
