import type { TemplateParserState } from "./state";

/**
 * Index just past the bracket matching `state.source[start - 1]`, skipping
 * brackets inside strings and template-literal interpolations. From svelte's
 * `utils/bracket.js`. Used for destructuring patterns and snippet type params.
 */
const DEFAULT_BRACKETS: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
const DEFAULT_CLOSE = new Set(Object.values(DEFAULT_BRACKETS));

export function matchBracket(
  state: TemplateParserState,
  start: number,
  brackets: Record<string, string> = DEFAULT_BRACKETS,
): number {
  const close = brackets === DEFAULT_BRACKETS ? DEFAULT_CLOSE : new Set(Object.values(brackets));
  const stack: string[] = [];

  let i = start;
  while (i < state.source.length) {
    const char = state.source[i++];

    if (char === "'" || char === '"' || char === "`") {
      i = matchQuote(state, i, char);
      continue;
    }

    if (Object.hasOwn(brackets, char)) {
      stack.push(char);
    } else if (close.has(char)) {
      const popped = stack.pop();
      const expected = popped ? brackets[popped] : undefined;
      if (char !== expected) {
        throw new Error(`sveld: expected "${expected}"`);
      }
      if (stack.length === 0) return i;
    }
  }

  throw new Error("sveld: unexpected end of input");
}

function matchQuote(state: TemplateParserState, start: number, quote: string): number {
  let escaped = false;
  let i = start;

  while (i < state.source.length) {
    const char = state.source[i++];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === quote) return i;
    if (char === "\\") escaped = true;

    if (quote === "`" && char === "$" && state.source[i] === "{") {
      i = matchBracket(state, i);
    }
  }

  throw new Error("sveld: unterminated string constant");
}
