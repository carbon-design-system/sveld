// @ts-expect-error acorn's published types don't declare these. svelte's
// phases/1-parse/index.js imports them the same way.
import { isIdentifierChar, isIdentifierStart } from "acorn";
import type { Expression } from "estree";
import { parseExpressionAt } from "./acorn-bridge";
import { isWhitespace } from "./reader";
import type { TemplateParserState } from "./state";

/**
 * Words that can't be fast-pathed as a bare `Identifier` expression: reserved
 * in module (strict) code, or parsed by acorn as a different node type
 * (`this` is a `ThisExpression`; `true`/`false`/`null` are handled inline).
 */
// biome-ignore format: one word per entry reads worse than a packed list
const NON_IDENTIFIER_WORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
  "do", "else", "enum", "export", "extends", "finally", "for", "function", "if", "implements",
  "import", "in", "instanceof", "interface", "let", "new", "package", "private", "protected",
  "public", "return", "static", "super", "switch", "this", "throw", "try", "typeof", "var",
  "void", "while", "with", "yield",
]);

/**
 * Longest-first so `===`/`!==` win over their prefixes. Assignment forms
 * (`&&=` etc.) match the shorter operator, fail the right-operand scan, and
 * fall back to acorn. `in`/`instanceof`/`<`/`>` stay out. Word operators
 * collide with identifiers, angle brackets with TS generics.
 */
const LOGICAL_OPERATORS = ["&&", "||", "??"];
const BINARY_OPERATORS = ["===", "!==", "==", "!="];

/** End of the identifier starting at `from`, or `from` if there isn't one. */
function scanIdentifier(source: string, from: number): number {
  const code = source.codePointAt(from);
  if (code === undefined || !isIdentifierStart(code, true)) return from;
  let end = from + (code <= 0xffff ? 1 : 2);
  while (end < source.length) {
    const next = source.codePointAt(end) as number;
    if (!isIdentifierChar(next, true)) break;
    end += next <= 0xffff ? 1 : 2;
  }
  return end;
}

/** End of the digit run starting at `from`. */
function scanDigits(source: string, from: number): number {
  let end = from;
  while (end < source.length) {
    const code = source.charCodeAt(end);
    if (code < 48 || code > 57) break;
    end++;
  }
  return end;
}

function skipWhitespace(source: string, from: number): number {
  let index = from;
  while (index < source.length && isWhitespace(source.charCodeAt(index))) index++;
  return index;
}

interface TrivialNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/**
 * An integer `Literal` ending at `end`, or null when the digits continue into
 * `5.`/`5e3`/`5n` territory or carry legacy-octal leading zeros.
 */
function scanIntegerLiteral(source: string, from: number): TrivialNode | null {
  const end = scanDigits(source, from);
  if (end === from) return null;
  if (source.charCodeAt(from) === 48 /* 0 */ && end - from > 1) return null;
  if (end < source.length) {
    const next = source.codePointAt(end) as number;
    if (next === 46 /* . */ || isIdentifierChar(next, true)) return null;
  }
  const raw = source.slice(from, end);
  return { type: "Literal", start: from, end, value: Number(raw), raw };
}

/** A single-quoted or double-quoted string with no escapes or newlines. */
function scanStringLiteral(source: string, from: number): TrivialNode | null {
  const quote = source.charCodeAt(from);
  let end = from + 1;
  while (end < source.length) {
    const code = source.charCodeAt(end);
    if (code === quote) {
      const raw = source.slice(from, end + 1);
      return { type: "Literal", start: from, end: end + 1, value: source.slice(from + 1, end), raw };
    }
    if (code === 92 /* \ */ || code === 10 /* \n */ || code === 13 /* \r */) return null;
    end++;
  }
  return null;
}

/**
 * Primary expression: identifier / keyword literal / integer / string, with
 * `.ident`, `[digits]`, and `["str"]` member segments after identifier heads.
 */
function scanAtom(source: string, from: number): TrivialNode | null {
  const code = source.charCodeAt(from);

  if (code === 34 /* " */ || code === 39 /* ' */) {
    return scanStringLiteral(source, from);
  }

  const identifierEnd = scanIdentifier(source, from);
  if (identifierEnd === from) {
    return scanIntegerLiteral(source, from);
  }

  const name = source.slice(from, identifierEnd);
  if (name === "true" || name === "false") {
    return { type: "Literal", start: from, end: identifierEnd, value: name === "true", raw: name };
  }
  if (name === "null") {
    return { type: "Literal", start: from, end: identifierEnd, value: null, raw: name };
  }
  if (NON_IDENTIFIER_WORDS.has(name)) return null;

  let node: TrivialNode = { type: "Identifier", start: from, end: identifierEnd, name };
  let index = identifierEnd;

  // Member segments. `true.x` and `"a".length` are rare enough to leave to acorn.
  while (index < source.length) {
    const next = source.charCodeAt(index);
    if (next === 46 /* . */) {
      const propertyStart = index + 1;
      const propertyEnd = scanIdentifier(source, propertyStart);
      if (propertyEnd === propertyStart) return null;
      const property = {
        type: "Identifier",
        start: propertyStart,
        end: propertyEnd,
        name: source.slice(propertyStart, propertyEnd),
      };
      node = {
        type: "MemberExpression",
        start: from,
        end: propertyEnd,
        object: node,
        property,
        computed: false,
        optional: false,
      };
      index = propertyEnd;
    } else if (next === 91 /* [ */) {
      const keyStart = index + 1;
      const keyCode = source.charCodeAt(keyStart);
      const property =
        keyCode === 34 /* " */ || keyCode === 39 /* ' */
          ? scanStringLiteral(source, keyStart)
          : scanIntegerLiteral(source, keyStart);
      if (!property || source.charCodeAt(property.end) !== 93 /* ] */) return null;
      node = {
        type: "MemberExpression",
        start: from,
        end: property.end + 1,
        object: node,
        property,
        computed: true,
        optional: false,
      };
      index = property.end + 1;
    } else {
      break;
    }
  }

  return node;
}

/** An atom with any number of `!` prefixes, e.g. `!hideLabel`, `!!value`. */
function scanOperand(source: string, from: number): TrivialNode | null {
  if (source.charCodeAt(from) !== 33 /* ! */ || source.charCodeAt(from + 1) === 61 /* = */) {
    return scanAtom(source, from);
  }
  const argument = scanOperand(source, skipWhitespace(source, from + 1));
  if (!argument) return null;
  return { type: "UnaryExpression", start: from, end: argument.end, operator: "!", prefix: true, argument };
}

function matchOperator(source: string, from: number): { operator: string; logical: boolean } | null {
  for (const operator of BINARY_OPERATORS) {
    if (source.startsWith(operator, from)) return { operator, logical: false };
  }
  for (const operator of LOGICAL_OPERATORS) {
    if (source.startsWith(operator, from)) return { operator, logical: true };
  }
  return null;
}

/** True if only whitespace remains before `}` (tags, attributes) or `)` (each-block keys). */
function atTerminator(source: string, from: number): boolean {
  const index = skipWhitespace(source, from);
  if (index >= source.length) return false;
  const code = source.charCodeAt(index);
  return code === 125 /* } */ || code === 41 /* ) */;
}

/**
 * Skips acorn for the expressions that show up constantly: `{ident}`,
 * `{a.b.c}`, `{a[0]}`, `{true}`, `{42}`, `{"str"}`, `{!flag}`, and one
 * binary or logical operator between two of those (`{size === "sm"}`,
 * `{a || b}`). Acorn's parser construction and tokenizer are most of
 * template-parse time. One operator max, so precedence is just that `!`
 * binds tighter. Fires only when the rest of the expression is whitespace
 * then `}` or `)`. Chains, calls, ternaries, comments, and TS go to acorn.
 */
function tryReadTrivialExpression(state: TemplateParserState): Expression | null {
  const source = state.source;

  const left = scanOperand(source, state.index);
  if (!left) return null;

  if (atTerminator(source, left.end)) {
    state.index = left.end;
    return left as unknown as Expression;
  }

  const operatorStart = skipWhitespace(source, left.end);
  const match = matchOperator(source, operatorStart);
  if (!match) return null;

  const right = scanOperand(source, skipWhitespace(source, operatorStart + match.operator.length));
  if (!right || !atTerminator(source, right.end)) return null;

  state.index = right.end;
  return {
    type: match.logical ? "LogicalExpression" : "BinaryExpression",
    start: left.start,
    end: right.end,
    left,
    operator: match.operator,
    right,
  } as unknown as Expression;
}

/** One JS/TS expression, including a trailing comment. Matches svelte's `read_expression`. */
export function readExpression(state: TemplateParserState): Expression {
  const trivial = tryReadTrivialExpression(state);
  if (trivial) return trivial;

  const { node, end } = parseExpressionAt(state.source, state.index, state.isTypeScript, state.root.comments);
  state.index = end;
  return node as unknown as Expression;
}
