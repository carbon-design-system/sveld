import { formatGeneratedTypeScript } from "../src/writer/format-generated-ts";

/**
 * The formatter has no unit coverage of its own otherwise: every fixture
 * `output*.d.ts` goes through it, but those exercise the generator's usual
 * shapes. These pin the scanner rules a rewrite can silently break: string
 * and comment skipping, empty blocks, the collapse budget, interface bodies,
 * blank-line normalization, and bracket-depth indentation.
 */
describe("formatGeneratedTypeScript", () => {
  test("never treats `;`, `{`, or `}` inside string or template literals as structure", () => {
    const raw = "type A = { a: \"x;y{z}\"; b: ';{'; c: `t;{` };";
    expect(formatGeneratedTypeScript(raw)).toBe("type A = {\n  a: \"x;y{z}\";\n  b: ';{';\n  c: `t;{`\n};\n");
  });

  test("ignores braces and semicolons inside block comments", () => {
    const raw = "/** {@link Foo} ; see */\ntype A = { a: string; b: number };";
    expect(formatGeneratedTypeScript(raw)).toBe(
      "/** {@link Foo} ; see */\ntype A = {\n  a: string;\n  b: number\n};\n",
    );
  });

  test("copies an unterminated string literal through untouched", () => {
    const raw = 'type A = { a: "oops; b: string };';
    expect(formatGeneratedTypeScript(raw)).toBe(`${raw}\n`);
  });

  test("trims the same characters as String#trim, including non-breaking spaces", () => {
    const raw = "  type A = string;\n export type B = number; ";
    expect(formatGeneratedTypeScript(raw)).toBe("type A = string;\nexport type B = number;\n");
  });

  test("keeps the braces of an empty block together", () => {
    expect(formatGeneratedTypeScript("interface Empty {   }\ntype T = {\n};")).toBe(
      "interface Empty {}\ntype T = {};\n",
    );
  });

  test("always expands an interface body, even a one-member one", () => {
    expect(formatGeneratedTypeScript("interface Props { a: string }")).toBe("interface Props {\n  a: string\n}\n");
  });

  test("keeps a single-member type literal that already spans lines expanded", () => {
    expect(formatGeneratedTypeScript("type P = {\n  a: string\n};")).toBe("type P = {\n  a: string\n};\n");
  });

  test("collapses short nested single-member blocks while expanding the multi-member outer block", () => {
    const raw = "type P = { a: { b: string }; c: Array<{ id: string }> };";
    expect(formatGeneratedTypeScript(raw)).toBe("type P = {\n  a: { b: string };\n  c: Array<{ id: string }>\n};\n");
  });

  test("expands a single-member block whose collapsed form exceeds the width budget", () => {
    const name = "a".repeat(130);
    expect(formatGeneratedTypeScript(`type L = { ${name}: string };`)).toBe(`type L = {\n  ${name}: string\n};\n`);
  });

  test("collapses blank-line runs, drops blanks after an opener, and trims trailing blanks", () => {
    const raw = "type A = string;\n\n\n\ntype B = {\n\n  a: string;\n\n\n  b: number;\n\n};\n\n\n";
    expect(formatGeneratedTypeScript(raw)).toBe("type A = string;\n\ntype B = {\n  a: string;\n\n  b: number;\n};\n");
  });

  test("indents by bracket depth, counting `<`/`>` but not the `>` of `=>`, and outdents closer lines", () => {
    const raw =
      "export default class C<T extends {\n  id: string;\n}> extends Base<\n  Props\n> {}\ntype F = (a: string) => {\nb: number;\n};";
    expect(formatGeneratedTypeScript(raw)).toBe(
      "export default class C<T extends {\n    id: string;\n  }> extends Base<\n  Props\n> {}\ntype F = (a: string) => {\n  b: number;\n};\n",
    );
  });

  test("is stable: formatting its own output again changes nothing", () => {
    const raw =
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a template-literal index signature is exactly what generated .d.ts contains
      'import { SvelteComponentTyped } from "svelte";\n\n    type $Props = {\n      \n      /**\n* Doc {@link X}\n* @default false\n*/\n      checked?: boolean;\n\n      items?: Array<{ id: string; value: number | string; meta?: Record<string, unknown> }>;\n\n      [key: `data-${string}`]: unknown;\n    };\n\nexport default class Checkbox extends SvelteComponentTyped<\n      $Props,\n      { change: CustomEvent<{ checked: boolean }> },\n      {}\n    > {}\n';
    const once = formatGeneratedTypeScript(raw);
    expect(formatGeneratedTypeScript(once)).toBe(once);
  });
});
