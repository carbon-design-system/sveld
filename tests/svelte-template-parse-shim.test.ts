import path from "node:path";
import { Glob } from "bun";
import { parse as realParse } from "svelte/compiler";
import { TemplateParseNotImplementedError, parse as templateParse } from "../src/svelte-template-parse";

/**
 * Compares `src/template-parse/` against `svelte/compiler`'s modern AST
 * (`parse(source, { modern: true })`).
 *
 * Structural `toEqual`, not `JSON.stringify`. This parser is independent of
 * svelte's, so field order can differ without meaning anything.
 *
 * `TemplateParseNotImplementedError` means the fixture isn't covered yet.
 * `normalize` drops fields sveld never reads: `name_loc`, expression `.loc`,
 * `SnippetBlock.parameters`/`.typeParams`, `trailingComments`, directive
 * modifiers, `TransitionDirective.intro`/`.outro`, body `Text.data`, and
 * StyleSheet `children`/`comments`/`content`. `leadingComments` and `Text.raw`
 * stay, because those are read.
 */

const root = path.join(process.cwd(), "tests");
const files: string[] = [];

// Skip e2e fixture projects' installed node_modules. Those trees can contain
// thousands of unrelated third-party .svelte files.
for await (const file of new Glob("**/*.svelte").scan(root)) {
  if (file.includes("node_modules")) continue;
  files.push(path.join(root, file));
}

test("found a substantial number of fixture .svelte files to compare against", () => {
  expect(files.length).toBeGreaterThan(100);
});

let coveredCount = 0;
let notImplementedCount = 0;

/** Drops fields sveld never reads so the compare only fails on differences that matter. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;

  const node = value as Record<string, unknown>;
  if (typeof node.type !== "string") {
    const clone: Record<string, unknown> = {};
    for (const key in node) clone[key] = normalize(node[key]);
    return clone;
  }

  const clone: Record<string, unknown> = {};
  for (const key in node) {
    if (key === "name_loc" || key === "loc" || key === "trailingComments" || key === "modifiers") continue;
    if (node.type === "SnippetBlock" && (key === "parameters" || key === "typeParams")) continue;
    if (node.type === "TransitionDirective" && (key === "intro" || key === "outro")) continue;
    // StyleSheet `children`/`comments`/`content` need a CSS parse we don't do.
    if (node.type === "StyleSheet" && (key === "children" || key === "comments" || key === "content")) continue;
    clone[key] = normalize(node[key]);
  }

  if (node.type === "SnippetBlock") clone.parameters = [];
  if (node.type === "Text") clone.data = clone.raw;

  return clone;
}

describe("parse() output matches svelte/compiler's modern AST, for constructs implemented so far", () => {
  for (const file of files) {
    const relative = path.relative(root, file);

    test(relative, async () => {
      const source = await Bun.file(file).text();

      let shim: unknown;
      try {
        shim = templateParse(source);
      } catch (error) {
        if (error instanceof TemplateParseNotImplementedError) {
          notImplementedCount++;
          return;
        }
        throw error;
      }

      coveredCount++;
      const real = realParse(source, { modern: true });
      expect(normalize(shim)).toEqual(normalize(real));
    });
  }

  afterAll(() => {
    console.log(
      `svelte-template-parse coverage: ${coveredCount}/${files.length} fixtures (${notImplementedCount} not yet implemented)`,
    );
  });
});
