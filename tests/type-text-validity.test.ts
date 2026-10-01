import { isValidTypeText } from "../src/type-text-validity";

describe("isValidTypeText", () => {
  test("rejects a `//` comment that would comment out the code after the type", () => {
    expect(isValidTypeText("string // the size")).toBe(false);
    expect(isValidTypeText("{ a: string // first }")).toBe(false);
  });

  test("allows block comments, `//` ended by a line break, and `//` inside strings", () => {
    expect(isValidTypeText("string /* the size */")).toBe(true);
    expect(isValidTypeText("{ a: string; // first\n b: number }")).toBe(true);
    expect(isValidTypeText('"http://a" | "https://b"')).toBe(true);
  });
});
