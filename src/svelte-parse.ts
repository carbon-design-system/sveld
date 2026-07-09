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

import { walk as zimmerframeWalk } from "zimmerframe";
import { convert } from "../node_modules/svelte/src/compiler/legacy.js";
// @ts-expect-error - internal svelte module, no published types
import { parse as parseFragment } from "../node_modules/svelte/src/compiler/phases/1-parse/index.js";
// @ts-expect-error - internal svelte module, no published types
import { reset as resetCompilerState } from "../node_modules/svelte/src/compiler/state.js";
// @ts-expect-error - internal svelte module, no published types
import { VERSION } from "../node_modules/svelte/src/version.js";

function removeByteOrderMark(source: string): string {
  return source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
}

/** Mirrors `svelte/compiler`'s own internal `to_public_ast`, which is equally loosely typed. */
// biome-ignore lint/suspicious/noExplicitAny: mirrors upstream svelte's untyped AST-shape-agnostic cleanup
function toPublicAst(source: string, ast: any, modern: boolean | undefined): unknown {
  if (modern) {
    // biome-ignore lint/suspicious/noExplicitAny: same as above
    const clean = (node: any) => {
      // biome-ignore lint/performance/noDelete: mirrors upstream svelte, which removes (not nulls) the property
      delete node.metadata;
    };

    for (const attribute of ast.options?.attributes ?? []) {
      clean(attribute);
      clean(attribute.value);
      if (Array.isArray(attribute.value)) {
        attribute.value.forEach(clean);
      }
    }

    return zimmerframeWalk(ast, null, {
      _(node: unknown, { next }: { next: () => void }) {
        clean(node);
        next();
      },
    });
  }

  return convert(source, ast);
}

export function parse(source: string, { modern, loose }: { modern?: boolean; loose?: boolean } = {}): unknown {
  const cleaned = removeByteOrderMark(source);
  resetCompilerState({ warning: () => false, filename: undefined });
  const ast = parseFragment(cleaned, loose);
  return toPublicAst(cleaned, ast, modern);
}

export { VERSION };
