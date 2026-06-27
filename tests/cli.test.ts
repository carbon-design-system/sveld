import { parseCliOptions } from "../src/cli";

describe("parseCliOptions", () => {
  test("--fail-fast enables failFast", () => {
    expect(parseCliOptions(["--fail-fast"])).toEqual({ failFast: true });
  });

  test("--fail-fast=false disables failFast", () => {
    expect(parseCliOptions(["--fail-fast=false"])).toEqual({ failFast: false });
  });

  test("failFast is absent by default", () => {
    expect(parseCliOptions(["--glob", "--types"])).toEqual({ glob: true, types: true });
  });
});
