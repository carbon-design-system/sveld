import { parseGenericsAttribute } from "../src/parser/generics";

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
    ).toEqual(["Row, K", "Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never"]);
  });
});
