import Writer, { createTypeScriptWriter } from "../src/writer/Writer";

describe("Writer", () => {
  beforeEach(() => {
    // Suppress Prettier console errors
    global.console.error = jest.fn();
  });

  test("TypeScript", async () => {
    const consoleError = jest.spyOn(console, "error");
    const writer = new Writer({ parser: "typescript", printWidth: 120 });

    expect(await writer.format("interface I {a:boolean}")).toEqual("interface I {\n  a: boolean;\n}\n");
    expect(consoleError).toHaveBeenCalledTimes(0);
    // Invalid JSON should emit Prettier parsing error
    expect(await writer.format("a:boolean}")).toEqual("a:boolean}");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  test("TypeScript writer default print width matches generated definitions", async () => {
    const writer = createTypeScriptWriter();

    expect(
      await writer.format(
        "export type Props = { first: string; second: string; third: string; fourth: string; fifth: string };",
      ),
    ).toBe(
      "export type Props = {\n  first: string;\n  second: string;\n  third: string;\n  fourth: string;\n  fifth: string;\n};\n",
    );
  });

  test("JSON", async () => {
    const consoleError = jest.spyOn(console, "error");
    const writer = new Writer({ parser: "json", printWidth: 80 });

    expect(await writer.format("{a:null}")).toEqual('{ "a": null }\n');

    expect(consoleError).toHaveBeenCalledTimes(0);
    // Invalid JSON should emit Prettier parsing error
    expect(await writer.format("a:null")).toEqual("a:null");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  test("Markdown", async () => {
    const writer = new Writer({ parser: "markdown", printWidth: 80 });

    expect(await writer.format("## text")).toEqual("## text\n");
    // @ts-expect-error
    expect(await writer.format({ a: null })).toEqual({ a: null });
  });

  test("format handles non-string inputs", async () => {
    const writer = new Writer({ parser: "json", printWidth: 80 });

    // @ts-expect-error
    expect(await writer.format({ complex: "object" })).toEqual({ complex: "object" });
    // @ts-expect-error
    expect(await writer.format(123)).toEqual(123);
    // @ts-expect-error
    expect(await writer.format(null)).toEqual(null);
    // @ts-expect-error
    expect(await writer.format(undefined)).toEqual(undefined);
  });
});
