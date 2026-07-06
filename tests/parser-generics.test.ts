import { parseGenericsAttribute, splitTopLevelCommas } from "../src/parser/generics";

describe("splitTopLevelCommas", () => {
  test("splits a simple comma-separated list", () => {
    expect(splitTopLevelCommas("Row, Header")).toEqual(["Row", " Header"]);
  });

  test("ignores commas nested inside angle brackets", () => {
    expect(splitTopLevelCommas("K extends keyof Map<string, Row> = never")).toEqual([
      "K extends keyof Map<string, Row> = never",
    ]);
  });

  test("ignores commas nested inside parentheses", () => {
    expect(splitTopLevelCommas("Fn extends (a: string, b: number) => void")).toEqual([
      "Fn extends (a: string, b: number) => void",
    ]);
  });

  test("ignores commas nested inside braces", () => {
    expect(splitTopLevelCommas("Row extends { a: string, b: number }")).toEqual([
      "Row extends { a: string, b: number }",
    ]);
  });

  test("ignores commas nested inside brackets", () => {
    expect(splitTopLevelCommas("Row extends [string, number]")).toEqual(["Row extends [string, number]"]);
  });

  test("splits multiple top-level params each containing nested commas", () => {
    expect(
      splitTopLevelCommas("Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never"),
    ).toEqual(["Row extends DataTableRow = DataTableRow", " K extends keyof Map<string, Row> = never"]);
  });
});

describe("parseGenericsAttribute", () => {
  test("returns null for an empty value", () => {
    expect(parseGenericsAttribute("")).toBeNull();
    expect(parseGenericsAttribute("   ")).toBeNull();
  });

  test("parses a single constrained generic", () => {
    expect(parseGenericsAttribute("Row extends DataTableRow = DataTableRow")).toEqual([
      "Row",
      "Row extends DataTableRow = DataTableRow",
    ]);
  });

  test("parses a bare generic name with no constraint", () => {
    expect(parseGenericsAttribute("Row")).toEqual(["Row", "Row"]);
  });

  test("parses multiple generics, one containing a comma in its constraint", () => {
    expect(
      parseGenericsAttribute("Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never"),
    ).toEqual(["Row,K", "Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never"]);
  });
});
