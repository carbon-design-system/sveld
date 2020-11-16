import * as test from "tape";
import Writer from "../src/writer/Writer";

test("Writer – TypeScript", (t) => {
  const writer = new Writer({ parser: "typescript", printWidth: 120 });

  t.equal(writer.format("interface I {a:boolean}"), "interface I {\n  a: boolean;\n}\n");
  t.equal(writer.format("a:boolean}"), "a:boolean}");
  t.end();
});

test("Writer – JSON", (t) => {
  const writer = new Writer({ parser: "json", printWidth: 80 });

  t.equal(writer.format("{a:null}"), '{ "a": null }\n');
  t.equal(writer.format("a:null"), "a:null");
  t.end();
});

test("Writer – Markdown", (t) => {
  const writer = new Writer({ parser: "markdown", printWidth: 80 });

  t.equal(writer.format("## text"), "## text\n");
  t.deepEqual(writer.format({ a: null }), { a: null });
  t.end();
});
