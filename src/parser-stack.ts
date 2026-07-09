/**
 * Lazily loads the parser stack (`ComponentParser` and the pruned svelte
 * parser in `./svelte-parse`, which together pull in acorn,
 * `@sveltejs/acorn-typescript`, comment-parser, and estree-walker) behind a
 * dynamic import.
 *
 * A fully cached run never needs to parse a single component, so it never
 * has to pay for evaluating any of that. Callers that are about to parse
 * (`bundle.ts`, `parse-entry-exports.ts`, `watch.ts`) await
 * `loadParserStack()` once up front, then read the resolved stack back
 * synchronously via `getParserStack()` for the rest of the (otherwise
 * synchronous) parse path. The load happens at most once per process.
 */
export interface ParserStack {
  ComponentParser: typeof import("./ComponentParser").default;
  parseSvelte: typeof import("./svelte-parse").parse;
}

let resolved: ParserStack | null = null;
let pending: Promise<ParserStack> | null = null;

export function loadParserStack(): Promise<ParserStack> {
  if (resolved) return Promise.resolve(resolved);
  if (!pending) {
    pending = Promise.all([import("./ComponentParser"), import("./svelte-parse")]).then(
      ([componentParserModule, svelteParseModule]) => {
        resolved = { ComponentParser: componentParserModule.default, parseSvelte: svelteParseModule.parse };
        return resolved;
      },
    );
  }
  return pending;
}

/** Reads back the stack resolved by a prior, already-awaited `loadParserStack()` call. */
export function getParserStack(): ParserStack {
  if (!resolved) {
    throw new Error("sveld: internal error, parser stack read before loadParserStack() resolved.");
  }
  return resolved;
}
