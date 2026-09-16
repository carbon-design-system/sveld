import { tsPlugin } from "@sveltejs/acorn-typescript";
import { Parser } from "acorn";
import { parse } from "../src/svelte-template-parse";
import { type LineTable, parseExpressionAt } from "../src/template-parse/acorn-bridge";

/**
 * `@sveltejs/acorn-typescript` forces `locations: true`. The bridge hands
 * acorn a precomputed `startLocation` for TS expressions instead of letting
 * acorn re-count the lines before the offset on every call, so the `loc` it
 * produces must equal what acorn computes on its own. Nothing in sveld reads
 * `loc`, which is exactly why this needs a direct check.
 */
const TSParser = Parser.extend(tsPlugin());
const NATIVE_OPTIONS = { sourceType: "module", ecmaVersion: 16, preserveParens: true, locations: true } as const;

function nativeLoc(source: string, index: number) {
  // biome-ignore lint/suspicious/noExplicitAny: acorn's option types don't expose the TS plugin's requirements
  const node = TSParser.parseExpressionAt(source, index, NATIVE_OPTIONS as any);
  return JSON.stringify(node.loc);
}

function bridgeLoc(source: string, index: number, lineTable?: LineTable) {
  const { node } = parseExpressionAt(source, index, true, [], lineTable);
  return JSON.stringify((node as { loc?: unknown }).loc);
}

/** Every `{expr}` start offset in `source`. */
function expressionOffsets(source: string): number[] {
  const offsets: number[] = [];
  for (let i = source.indexOf("{"); i !== -1; i = source.indexOf("{", i + 1)) offsets.push(i + 1);
  return offsets;
}

describe("TS expression start locations", () => {
  test("match acorn's own line/column for every line-break kind acorn recognizes", () => {
    // `\r\n`, lone `\n`, lone `\r`, and U+2028/U+2029 are all line breaks to
    // acorn's `lineBreak`; only `\n` resets its column.
    const source = "a\r\nb {x.y} c\n{f(1, 2)}\rd {q} {z + 1}\n\n{last}";
    const lineTable: LineTable = {};
    for (const index of expressionOffsets(source)) {
      expect(bridgeLoc(source, index, lineTable)).toBe(nativeLoc(source, index));
    }
  });

  test("reuse the same line table across every expression of one source", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i} {v${i}}`);
    const source = lines.join("\n");
    const lineTable: LineTable = {};
    const offsets = expressionOffsets(source);
    for (const index of offsets) expect(bridgeLoc(source, index, lineTable)).toBe(nativeLoc(source, index));
    // Built once, then reused: one entry per `\n`.
    expect(lineTable.breakEnds).toHaveLength(lines.length - 1);
  });

  test("still match acorn without a caller-provided table (synthetic sources)", () => {
    const source = "x\n\ny {a.b}";
    const index = source.indexOf("a");
    expect(bridgeLoc(source, index)).toBe(nativeLoc(source, index));
  });

  test("give every acorn-parsed template expression a `loc` on its real line through the full parser", () => {
    // `{n}` takes the trivial-expression fast path and carries no `loc`;
    // the other two go through acorn.
    const source =
      '<script lang="ts">\n  let n = 1;\n</script>\n\n<p>{n}</p>\n<p class={n > 1 ? "big" : "small"}>{n + 1}</p>';
    const root = parse(source) as { fragment: { nodes: Array<{ type: string; [key: string]: unknown }> } };
    const found: Array<{ line: number; column: number }> = [];
    (function walk(node: unknown) {
      if (!node || typeof node !== "object") return;
      const n = node as { type?: string; loc?: { start: { line: number; column: number } }; [key: string]: unknown };
      if (n.type === "ExpressionTag") {
        const expression = n.expression as { loc?: { start: { line: number; column: number } } };
        if (expression.loc) found.push(expression.loc.start);
      }
      for (const key in n) {
        const value = n[key];
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === "object") walk(value);
      }
    })(root.fragment);
    expect(found).toEqual([
      { line: 6, column: 10 },
      { line: 6, column: 36 },
    ]);
  });
});
