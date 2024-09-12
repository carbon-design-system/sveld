import Writer from "../src/writer/Writer";

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
    expect(await writer.format({ a: null })).toEqual({ a: null });
  });
});
