import { describe, test, expect } from "vitest";
import Writer from "../src/writer/Writer";

describe("Writer", () => {
  test("TypeScript", () => {
    const writer = new Writer({ parser: "typescript", printWidth: 120 });

    expect(writer.format("interface I {a:boolean}")).toEqual("interface I {\n  a: boolean;\n}\n");
    expect(writer.format("a:boolean}")).toEqual("a:boolean}");
  });

  test("JSON", () => {
    const writer = new Writer({ parser: "json", printWidth: 80 });

    expect(writer.format("{a:null}")).toEqual('{ "a": null }\n');
    expect(writer.format("a:null")).toEqual("a:null");
  });

  test("Markdown", () => {
    const writer = new Writer({ parser: "markdown", printWidth: 80 });

    expect(writer.format("## text")).toEqual("## text\n");
    expect(writer.format({ a: null })).toEqual({ a: null });
  });
});
