/**
 * Lazily loads `ComponentParser` and the template parser behind a dynamic
 * import. Those pull in acorn, `@sveltejs/acorn-typescript`, and zimmerframe.
 *
 * A fully cached run never parses, so it never evaluates any of that.
 * Callers about to parse (`bundle.ts`, `parse-entry-exports.ts`, `watch.ts`)
 * await `loadParserStack()` once, then read it back with `getParserStack()`.
 * The load happens at most once per process.
 */
export interface ParserStack {
  ComponentParser: typeof import("./ComponentParser").default;
  parseSvelte: typeof import("./svelte-template-parse").parse;
}

let resolved: ParserStack | null = null;
let pending: Promise<ParserStack> | null = null;

export function loadParserStack(): Promise<ParserStack> {
  if (resolved) return Promise.resolve(resolved);
  if (!pending) {
    pending = Promise.all([import("./ComponentParser"), import("./svelte-template-parse")]).then(
      ([componentParserModule, svelteParseModule]) => {
        resolved = { ComponentParser: componentParserModule.default, parseSvelte: svelteParseModule.parse };
        return resolved;
      },
    );
  }
  return pending;
}

/** The stack from a prior, already-awaited `loadParserStack()` call. */
export function getParserStack(): ParserStack {
  if (!resolved) {
    throw new Error("sveld: internal error, parser stack read before loadParserStack() resolved.");
  }
  return resolved;
}
