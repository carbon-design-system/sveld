import { parse } from "../src/svelte-template-parse";

/**
 * svelte's public AST never contains `ParenthesizedExpression`. The bridge
 * parses with `preserveParens` and unwraps afterwards, but only when the
 * parser reported building one, so every place acorn or acorn-typescript can
 * produce a paren node has to trip that flag.
 */
function parenthesizedCount(root: unknown): number {
  let count = 0;
  (function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; [key: string]: unknown };
    if (n.type === "ParenthesizedExpression") count++;
    for (const key in n) {
      const value = n[key];
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") walk(value);
    }
  })(root);
  return count;
}

function expressions(source: string): unknown[] {
  const root = parse(source) as { fragment: { nodes: Array<{ type: string; expression?: unknown }> } };
  return root.fragment.nodes.filter((node) => node.type === "ExpressionTag").map((node) => node.expression);
}

describe("ParenthesizedExpression unwrapping", () => {
  test("unwraps parens nested anywhere in a JS expression", () => {
    const source = "{(a)}{f((a))}{(a, b) => (c)}{x ? (y) : (z)}{[(a), ((b))]}";
    const nodes = expressions(source);
    expect(nodes).toHaveLength(5);
    expect(parenthesizedCount(nodes)).toBe(0);
    expect((nodes[0] as { type: string }).type).toBe("Identifier");
    expect((nodes[2] as { body: { type: string } }).body.type).toBe("Identifier");
  });

  test("leaves calls and arrows alone when there is nothing to unwrap", () => {
    const nodes = expressions("{f(a)}{(a) => a + 1}{new X(1)}");
    expect(parenthesizedCount(nodes)).toBe(0);
    expect(nodes.map((node) => (node as { type: string }).type)).toEqual([
      "CallExpression",
      "ArrowFunctionExpression",
      "NewExpression",
    ]);
  });

  test("unwraps parens in TypeScript expressions, including a parenthesized decorator", () => {
    const source = '<script lang="ts"></script>\n{(a as string)}{class { @(dec) m() {} }}{f<number>((x))}';
    const nodes = expressions(source);
    expect(nodes).toHaveLength(3);
    expect(parenthesizedCount(nodes)).toBe(0);
    const decorated = nodes[1] as { body: { body: Array<{ decorators: Array<{ expression: { type: string } }> }> } };
    expect(decorated.body.body[0].decorators[0].expression.type).toBe("Identifier");
  });
});
