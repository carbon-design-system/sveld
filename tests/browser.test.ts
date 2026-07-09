import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  asNormalizedPath,
  buildComponentApiDocument,
  buildCustomElementsManifest,
  type ComponentDocApi,
  ComponentParser,
  writeMarkdownCore,
  writeTsDefinition,
} from "../src/browser";

const NODE_BUILTIN_IMPORT_REGEX = /from\s+["']node:[^"']+["']|require\(\s*["']node:[^"']+["']\s*\)/;
const RELATIVE_IMPORT_REGEX = /from\s+["'](\.\.?\/[^"']+)["']/g;
// Uniform `import type { ... } from "..."` / `export type { ... } from "..."` statements are erased
// by the compiler, so their target module never actually ships in the browser bundle - don't walk into them.
// (Individual `type X` specifiers inside a mixed `export { a, type B } from "..."` statement still count
// as a real import of that module, since `a` is a value.)
const TYPE_ONLY_IMPORT_STATEMENT_REGEX = /\b(?:import|export)\s+type\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g;
const FILE_EXTENSION_REGEX = /\.[a-zA-Z0-9]+$/;

/** Strips `/* ... *\/` block comments (JSDoc included) so example code in doc comments doesn't get mistaken for real imports. */
function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Walks every module reachable from `src/browser.ts` via relative imports
 * and asserts none of them import a `node:*` built-in. Bare specifiers
 * (npm packages like `svelte/compiler`) are out of scope; they're expected
 * to be browser-safe on their own and get bundled by the consumer's tool.
 */
function collectRelativeImportGraph(entryFile: string): Map<string, string> {
  const files = new Map<string, string>();
  const queue = [entryFile];

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || files.has(file)) continue;

    const source = readFileSync(file, "utf-8");
    files.set(file, source);
    const codeOnly = stripBlockComments(source).replace(TYPE_ONLY_IMPORT_STATEMENT_REGEX, "");

    for (const match of codeOnly.matchAll(RELATIVE_IMPORT_REGEX)) {
      const specifier = match[1];
      // Imports of non-`.ts` files (e.g. `../../package.json`) already carry their extension.
      const hasExtension = FILE_EXTENSION_REGEX.test(specifier);
      const resolved = resolve(dirname(file), hasExtension ? specifier : `${specifier}.ts`);
      if (!files.has(resolved)) queue.push(resolved);
    }
  }

  return files;
}

function toComponentDocApi(
  parsed: ReturnType<ComponentParser["parseSvelteComponent"]>,
  moduleName: string,
  filePath: string,
): ComponentDocApi {
  return { ...parsed, moduleName, filePath: asNormalizedPath(filePath) };
}

describe("sveld/browser", () => {
  test("the entire relative-import graph is free of node: built-ins", () => {
    const entry = join(__dirname, "..", "src", "browser.ts");
    const graph = collectRelativeImportGraph(entry);

    expect(graph.size).toBeGreaterThan(5);

    const offenders = Array.from(graph.entries())
      .filter(([, source]) => NODE_BUILTIN_IMPORT_REGEX.test(stripBlockComments(source)))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  test("parses a component and renders every output format", () => {
    const source = `<script>
  /** Button label */
  export let label = "Click me";
</script>
<button>{label}</button>
`;

    const parser = new ComponentParser();
    const parsed = parser.parseSvelteComponent(source, { moduleName: "Button", filePath: "Button.svelte" });
    const components = new Map([["Button", toComponentDocApi(parsed, "Button", "Button.svelte")]]);

    const jsonDoc = buildComponentApiDocument(components);
    expect(jsonDoc.components).toHaveLength(1);
    expect(jsonDoc.components[0].moduleName).toBe("Button");

    const markdown = writeMarkdownCore(components);
    expect(markdown).toContain("Button");

    const dts = writeTsDefinition(jsonDoc.components[0]);
    expect(dts).toContain("label");

    const cem = buildCustomElementsManifest(components, {
      resolveModulePath: (component) => component.filePath,
    });
    expect(cem.modules).toHaveLength(1);
  });

  test("a single ComponentParser instance can be reused across parses", () => {
    const parser = new ComponentParser();

    const first = parser.parseSvelteComponent("<script>export let a;</script>", {
      moduleName: "A",
      filePath: "A.svelte",
    });
    const second = parser.parseSvelteComponent("<script>export let b;</script>", {
      moduleName: "B",
      filePath: "B.svelte",
    });

    expect(first.props.map((p) => p.name)).toEqual(["a"]);
    expect(second.props.map((p) => p.name)).toEqual(["b"]);
  });
});
