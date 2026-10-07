/**
 * Lazily loads the parser stack (`./parser-stack-modules`), so a fully cached
 * run never evaluates sveast. Callers about to parse await `loadParserStack()`
 * once, then read it back with `getParserStack()`.
 */
type ParserStack = typeof import("./parser-stack-modules");

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

export function getParserStack(): ParserStack {
  if (!resolved) {
    throw new Error("sveld: internal error, parser stack read before loadParserStack() resolved.");
  }
  return resolved;
}
