import { parseObjectTypeLiteralMembers } from "../src/parser/object-type-literal";
import {
  indexOfClosingBracket,
  indexOfTopLevel,
  indexOfTopLevelArrow,
  isTupleType,
  returnTypeOfFunctionType,
  scanTypeText,
  splitTopLevel,
} from "../src/type-text";

describe("splitTopLevel", () => {
  test("splits a simple comma-separated list", () => {
    expect(splitTopLevel("Row, Header", ",")).toEqual(["Row", " Header"]);
  });

  test("ignores commas nested inside angle brackets", () => {
    expect(splitTopLevel("K extends keyof Map<string, Row> = never", ",")).toEqual([
      "K extends keyof Map<string, Row> = never",
    ]);
  });

  test("ignores commas nested inside parentheses", () => {
    expect(splitTopLevel("Fn extends (a: string, b: number) => void", ",")).toEqual([
      "Fn extends (a: string, b: number) => void",
    ]);
  });

  test("ignores commas nested inside braces", () => {
    expect(splitTopLevel("Row extends { a: string, b: number }", ",")).toEqual([
      "Row extends { a: string, b: number }",
    ]);
  });

  test("ignores commas nested inside brackets", () => {
    expect(splitTopLevel("Row extends [string, number]", ",")).toEqual(["Row extends [string, number]"]);
  });

  test("splits multiple top-level params each containing nested commas", () => {
    expect(
      splitTopLevel("Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never", ","),
    ).toEqual(["Row extends DataTableRow = DataTableRow", " K extends keyof Map<string, Row> = never"]);
  });

  test("does not close a bracket at the > of an arrow", () => {
    expect(splitTopLevel("T extends Map<(a: string) => void, number>, U", ",")).toEqual([
      "T extends Map<(a: string) => void, number>",
      " U",
    ]);
  });

  test("ignores separators inside string and template literals", () => {
    expect(splitTopLevel(`T extends "a,b" | 'c,d', U`, ",")).toEqual([`T extends "a,b" | 'c,d'`, " U"]);
    expect(splitTopLevel('a: `x;y`; b: "\\";"', ";")).toEqual(["a: `x;y`", ' b: "\\";"']);
  });

  test("splits on any of several separators", () => {
    expect(splitTopLevel("a: 1; b: { c: 2; d: 3 }, e: 4", ";,")).toEqual(["a: 1", " b: { c: 2; d: 3 }", " e: 4"]);
  });
});

describe("indexOfTopLevel", () => {
  test("skips nested and quoted matches", () => {
    expect(indexOfTopLevel('"a:b"', ":")).toBe(-1);
    expect(indexOfTopLevel("{ a: 1 }", ":")).toBe(-1);
    expect(indexOfTopLevel('"a:b": Map<() => void, string>', ":")).toBe(5);
  });
});

describe("indexOfTopLevelArrow", () => {
  test("finds the outer arrow of a function type with a callback param", () => {
    const type = "(cb: () => void) => string";
    expect(indexOfTopLevelArrow(type)).toBe(type.lastIndexOf("=>"));
  });

  test("returns -1 without a top-level arrow", () => {
    expect(indexOfTopLevelArrow("Array<() => void>")).toBe(-1);
    expect(indexOfTopLevelArrow('"=>"')).toBe(-1);
  });
});

describe("indexOfClosingBracket", () => {
  test("matches across arrows and quoted brackets", () => {
    const text = 'EventDispatcher<{ a: () => void; "b>": string }> & X';
    expect(indexOfClosingBracket(text, text.indexOf("<"))).toBe(text.indexOf("> &"));
  });

  test("returns -1 when the bracket never closes", () => {
    expect(indexOfClosingBracket("{ a: string", 0)).toBe(-1);
  });
});

describe("isTupleType", () => {
  test("accepts tuple types, labeled or not", () => {
    expect(isTupleType("[number, string]")).toBe(true);
    expect(isTupleType(" [item: string, index?: number] ")).toBe(true);
    expect(isTupleType("[]")).toBe(true);
  });

  test("rejects arrays of tuples and non-tuple types", () => {
    expect(isTupleType("[number, string][]")).toBe(false);
    expect(isTupleType("[A] | [B]")).toBe(false);
    expect(isTupleType("{ count: number }")).toBe(false);
    expect(isTupleType("string[]")).toBe(false);
  });
});

describe("returnTypeOfFunctionType", () => {
  test("returns the text after the first top-level arrow", () => {
    expect(returnTypeOfFunctionType("() => string")).toBe("string");
    expect(returnTypeOfFunctionType("(a: string) => () => void")).toBe("() => void");
    expect(returnTypeOfFunctionType("(cb: () => void) => number")).toBe("number");
  });

  test("returns undefined for a non-function type", () => {
    expect(returnTypeOfFunctionType("Handler<() => void>")).toBeUndefined();
    expect(returnTypeOfFunctionType(undefined)).toBeUndefined();
  });
});

describe("scanTypeText", () => {
  test("carries depth across ranges and never goes below 0", () => {
    const text = "{ a: Array<\n() => void> }\n}";
    const firstLineEnd = text.indexOf("\n");
    const depth = scanTypeText(text, undefined, 0, firstLineEnd);
    expect(depth).toBe(2);
    expect(scanTypeText(text, undefined, firstLineEnd + 1, text.length, depth)).toBe(0);
  });
});

describe("parseObjectTypeLiteralMembers", () => {
  test("keeps a separator inside a string literal member type", () => {
    expect(parseObjectTypeLiteralMembers('{ a: "x;y"; b: number }')).toEqual([
      { name: "a", type: '"x;y"', optional: false },
      { name: "b", type: "number", optional: false },
    ]);
  });

  test("keeps a comma after an arrow nested in a generic", () => {
    expect(parseObjectTypeLiteralMembers("{ a: Record<() => void, string>; b: number }")).toEqual([
      { name: "a", type: "Record<() => void, string>", optional: false },
      { name: "b", type: "number", optional: false },
    ]);
  });
});
