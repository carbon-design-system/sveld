/**
 * Lazily loads the parser stack (`./parser-stack-modules`) behind a dynamic
 * import: `ComponentParser`, the template and script parsers, and the JSDoc
 * helpers, which pull in acorn and `@sveltejs/acorn-typescript`.
 *
 * A fully cached run never parses, so it never evaluates any of that.
 * Callers about to parse (`bundle.ts`, `parse-entry-exports.ts`, `watch.ts`)
 * await `loadParserStack()` once, then read it back with `getParserStack()`.
 * The load happens at most once per process.
 */
export type ParserStack = typeof import("./parser-stack-modules");

let resolved: ParserStack | null = null;
let pending: Promise<ParserStack> | null = null;

export function loadParserStack(): Promise<ParserStack> {
  if (resolved) return Promise.resolve(resolved);
  if (!pending) {
    pending = import("./parser-stack-modules").then((stack) => {
      resolved = stack;
      return stack;
    });
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
