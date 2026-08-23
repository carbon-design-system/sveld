import { parse } from "../src/svelte-template-parse";
import { acornExpressionParses, parseExpressionAt } from "../src/template-parse/acorn-bridge";
import { readExpression } from "../src/template-parse/expression";
import { TemplateParserState } from "../src/template-parse/state";

/**
 * `readExpression` must match a direct acorn `parseExpressionAt` on every
 * shape. Same node, same cursor, or the same throw. The acorn call counter
 * records which route ran. Losing the fast path is a perf regression.
 * Gaining it on a shape that shouldn't is a correctness bug.
 */

/** Shapes the fast path must handle without calling acorn. */
const FAST_PATH_SHAPES = [
  "a",
  "_",
  "$a",
  "$$restProps",
  "a.b.c",
  "a.class",
  "a[0]",
  "a[10].b",
  'a["k"]',
  "a['k']",
  '$$props["aria-label"]',
  "true",
  "false",
  "null",
  "undefined",
  "42",
  "0",
  '"str"',
  "'str'",
  '""',
  '"a\'b"',
  "'a\"b'",
  "!x",
  "!!x",
  "! x",
  "!x.y",
  'a === "b"',
  "a !== b",
  "a == b",
  "a != b",
  "a!== b",
  "a && b",
  "a || b",
  "a ?? b",
  "!a && !b",
  "a.b === 1",
  '"x" === a',
  "änderung.übersicht",
  "π",
];

/** Shapes that must fall back to acorn and come out identical to it. */
const FALLBACK_SHAPES = [
  "  a", // leading whitespace: callers normally consume it first
  "a ? b : c",
  "a, b",
  "a + b",
  "a < b",
  "a > b",
  "a in b",
  "a instanceof b",
  "a ||= b",
  "a &&= b",
  "a ??= b",
  "a = b",
  "a?.b",
  "a?.[0]",
  "f()",
  "f(a)",
  "a.b()",
  "() => a",
  "(a) => a + 1",
  "[a, b]",
  "{ a: 1 }",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a template literal is exactly what this shape tests
  "`t${a}`",
  "new X()",
  "a.b[c]",
  "a[b]",
  "-1",
  "+x",
  "typeof a",
  "void 0",
  "this",
  "this.x",
  "true.x",
  "5.5",
  "5e3",
  "0x1F",
  "0.5",
  "1_000",
  '"a\\nb"',
  "a /* trailing */",
  "a . b",
];

/** Shapes where acorn throws; the fast path must not accept them either. */
const ERROR_SHAPES = ["05", "00", "let", "class", "5abc", '"unterminated', "a[01]"];

/** TS-only syntax: falls back to the TS-extended acorn under `lang="ts"`. */
const TS_FALLBACK_SHAPES = ["a as string", "a!", "a satisfies string", "f<string>(a)", "a as const"];

const TS_FAST_PATH_SHAPES = ["a", "a.b", 'size === "sm"', "!flag", '"str"'];

/** Forces `TemplateParserState.isTypeScript` without affecting offsets past it. */
const TS_PREFIX = '<script lang="ts"></script>';

type Outcome = { node: unknown; end: number } | { throws: true };

/**
 * Drops prototypes and normalizes bigints so acorn class instances compare
 * against plain nodes. Also drops `loc`. The TS acorn plugin forces
 * `locations: true`, sveld never reads it, and the shim test strips it.
 * Fast-path nodes omit it on purpose.
 */
function strip(node: unknown): unknown {
  return JSON.parse(
    JSON.stringify(node, (key, value) => {
      if (key === "loc") return undefined;
      return typeof value === "bigint" ? `bigint:${value}` : value;
    }),
  );
}

function referenceOutcome(source: string, index: number, isTypeScript: boolean): Outcome {
  try {
    const { node, end } = parseExpressionAt(source, index, isTypeScript, []);
    return { node: strip(node), end };
  } catch {
    return { throws: true };
  }
}

function actualOutcome(source: string, index: number): Outcome {
  const state = new TemplateParserState(source, source.length);
  state.index = index;
  try {
    const node = readExpression(state);
    return { node: strip(node), end: state.index };
  } catch {
    return { throws: true };
  }
}

function runShape(expression: string, useTsPrefix: boolean) {
  const prefix = useTsPrefix ? TS_PREFIX : "";
  const source = `${prefix}{${expression}}`;
  const index = prefix.length + 1;

  const reference = referenceOutcome(source, index, useTsPrefix);
  const before = acornExpressionParses.count;
  const actual = actualOutcome(source, index);
  const acornCalls = acornExpressionParses.count - before;

  expect(actual).toEqual(reference);
  return acornCalls;
}

describe("expression fast path matches acorn", () => {
  test.each(FAST_PATH_SHAPES)("fast path, no acorn: %s", (expression) => {
    expect(runShape(expression, false)).toBe(0);
  });

  test.each(FALLBACK_SHAPES)("falls back to acorn: %s", (expression) => {
    expect(runShape(expression, false)).toBeGreaterThan(0);
  });

  test.each(ERROR_SHAPES)("rejected by both: %s", (expression) => {
    expect(runShape(expression, false)).toBeGreaterThan(0);
  });

  test.each(TS_FAST_PATH_SHAPES)("fast path under lang=ts: %s", (expression) => {
    expect(runShape(expression, true)).toBe(0);
  });

  test.each(TS_FALLBACK_SHAPES)("falls back to TS acorn: %s", (expression) => {
    expect(runShape(expression, true)).toBeGreaterThan(0);
  });
});

describe("fast path fires end-to-end", () => {
  test("markup with only trivial expressions parses without any acorn expression call", () => {
    const before = acornExpressionParses.count;
    parse('<div class:a={x === "y"} data-b={items[0]} data-c={flag ?? "z"}>{!flag}{a.b}</div>');
    expect(acornExpressionParses.count).toBe(before);
  });

  test("non-trivial expressions still reach acorn", () => {
    const before = acornExpressionParses.count;
    parse("<div data-a={x ? 1 : 2}>{f(x)}</div>");
    expect(acornExpressionParses.count).toBe(before + 2);
  });
});
