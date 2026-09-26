import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ModuleGraph } from "../src/module-graph";
import { loadParserStack } from "../src/parser-stack";

/**
 * `ModuleGraph.resolve` decides file-vs-directory from the cached `readdir`
 * listing (`Dirent`) when the specifier names an entry exactly, and only
 * falls back to `stat` for a symlink or a case/normalization variant. Both
 * paths follow a symlink to its target, as an import would.
 */
describe("ModuleGraph.resolve", () => {
  let dir: string;
  let graph: ModuleGraph;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-resolve-module-file-"));
    mkdirSync(path.join(dir, "Button"));
    writeFileSync(path.join(dir, "Button", "index.js"), "export {};\n");
    writeFileSync(path.join(dir, "utils.ts"), "export {};\n");
    mkdirSync(path.join(dir, "Both"));
    writeFileSync(path.join(dir, "Both", "index.js"), "export {};\n");
    writeFileSync(path.join(dir, "Both.js"), "export {};\n");
    symlinkSync(path.join(dir, "utils.ts"), path.join(dir, "LinkedFile.ts"));
    symlinkSync(path.join(dir, "Button"), path.join(dir, "LinkedDir"));
    graph = new ModuleGraph();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("resolves a directory specifier to its index file and a bare name to its extension", () => {
    expect(graph.resolve("./Button", dir)).toBe(path.join(dir, "Button", "index.js"));
    expect(graph.resolve("./utils", dir)).toBe(path.join(dir, "utils.ts"));
    expect(graph.resolve("./utils.ts", dir)).toBe(path.join(dir, "utils.ts"));
  });

  test("prefers a sibling file with an extension over a same-named directory's index", () => {
    expect(graph.resolve("./Both", dir)).toBe(path.join(dir, "Both.js"));
  });

  test("resolves a .js-family specifier to the TypeScript file it stands for", () => {
    writeFileSync(path.join(dir, "state.svelte.ts"), "export {};\n");
    writeFileSync(path.join(dir, "esm.mts"), "export {};\n");
    writeFileSync(path.join(dir, "view.tsx"), "export {};\n");
    writeFileSync(path.join(dir, "Both.ts"), "export {};\n");
    graph.invalidate();

    expect(graph.resolve("./utils.js", dir)).toBe(path.join(dir, "utils.ts"));
    expect(graph.resolve("./state.svelte.js", dir)).toBe(path.join(dir, "state.svelte.ts"));
    expect(graph.resolve("./esm.mjs", dir)).toBe(path.join(dir, "esm.mts"));
    expect(graph.resolve("./view.jsx", dir)).toBe(path.join(dir, "view.tsx"));
    // A .js file that exists wins over its .ts twin.
    expect(graph.resolve("./Both.js", dir)).toBe(path.join(dir, "Both.js"));
    expect(graph.resolve("./nope.js", dir)).toBeNull();
  });

  test("returns null for a missing specifier", () => {
    expect(graph.resolve("./nope", dir)).toBeNull();
  });

  test("never resolves a bare package specifier to a file next to the importer", () => {
    expect(graph.resolve("utils", dir)).toBeNull();
    expect(graph.resolve("Button", dir)).toBeNull();
    expect(graph.resolve("./utils", dir)).toBe(path.join(dir, "utils.ts"));
    expect(graph.resolve(path.join(dir, "utils"), dir)).toBe(path.join(dir, "utils.ts"));
    expect(graph.resolve("../utils", path.join(dir, "Button"))).toBe(path.join(dir, "utils.ts"));
  });

  test("follows a symlink named exactly by the specifier, as the extension probe does", () => {
    expect(graph.resolve("./LinkedFile.ts", dir)).toBe(path.join(dir, "LinkedFile.ts"));
    expect(graph.resolve("./LinkedDir", dir)).toBe(path.join(dir, "LinkedDir", "index.js"));
    expect(graph.resolve("./LinkedFile", dir)).toBe(path.join(dir, "LinkedFile.ts"));
  });

  test("skips a broken symlink named exactly by the specifier", () => {
    symlinkSync(path.join(dir, "missing.ts"), path.join(dir, "Dangling"));
    writeFileSync(path.join(dir, "Dangling.ts"), "export {};\n");
    graph.invalidate();
    expect(graph.resolve("./Dangling", dir)).toBe(path.join(dir, "Dangling.ts"));
  });

  test("resolves a case variant through the lstat fallback on a case-insensitive filesystem", () => {
    const caseInsensitive = existsSync(path.join(dir, "BUTTON"));
    if (!caseInsensitive) return;
    expect(graph.resolve("./button", dir)).toBe(path.join(dir, "button", "index.js"));
    expect(graph.resolve("./UTILS", dir)).toBe(path.join(dir, "UTILS.ts"));
  });
});

describe("ModuleGraph caches", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-module-graph-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("keeps a module's parse until the module is invalidated", async () => {
    await loadParserStack();
    const file = path.join(dir, "utils.ts");
    writeFileSync(file, "export const a = 1;\n");
    const graph = new ModuleGraph();
    const first = graph.parse(file);
    expect(first?.source.text).toBe("export const a = 1;\n");

    writeFileSync(file, "export const b = 2;\n");
    expect(graph.parse(file)).toBe(first);

    graph.invalidate(path.join(dir, "other.ts"));
    expect(graph.parse(file)).toBe(first);

    graph.invalidate(file);
    expect(graph.parse(file)?.source.text).toBe("export const b = 2;\n");
  });

  test("sees a file added since the last lookup once invalidated", () => {
    const graph = new ModuleGraph();
    expect(graph.resolve("./later", dir)).toBeNull();

    writeFileSync(path.join(dir, "later.ts"), "export {};\n");
    expect(graph.resolve("./later", dir)).toBeNull();

    graph.invalidate(path.join(dir, "later.ts"));
    expect(graph.resolve("./later", dir)).toBe(path.join(dir, "later.ts"));
  });

  test("reads tsconfig paths once per graph, so another graph sees an edited config", () => {
    const writeConfig = (target: string) =>
      writeFileSync(
        path.join(dir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "$lib/*": [`./${target}/*`] } } }),
      );
    mkdirSync(path.join(dir, "a"));
    mkdirSync(path.join(dir, "b"));
    writeFileSync(path.join(dir, "a", "utils.ts"), "export {};\n");
    writeFileSync(path.join(dir, "b", "utils.ts"), "export {};\n");
    writeConfig("a");
    const graph = new ModuleGraph();
    expect(graph.resolve("$lib/utils", dir)).toBe(path.join(dir, "a", "utils.ts"));

    writeConfig("b");
    expect(graph.resolve("$lib/utils", dir)).toBe(path.join(dir, "a", "utils.ts"));
    expect(new ModuleGraph().resolve("$lib/utils", dir)).toBe(path.join(dir, "b", "utils.ts"));
  });
});
