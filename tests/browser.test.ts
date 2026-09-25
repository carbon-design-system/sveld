import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  asNormalizedPath,
  buildComponentApiDocument,
  buildCustomElementsManifest,
  type ComponentDocApi,
  ComponentParser,
  finalizeWithoutCrossFileResolution,
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

const SRC_ROOT = join(__dirname, "..", "src");

/**
 * Walks every module reachable from `src/browser.ts` via relative imports
 * and asserts none of them import a `node:*` built-in. Bare specifiers
 * (`svelte/compiler`, `acorn`, `@sveltejs/acorn-typescript`) are out of
 * scope. They're expected to be browser-safe and bundled by the consumer.
 * Nothing in `src/` currently imports outside `src/`.
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
      // Cross-platform "is resolved inside SRC_ROOT" check: a plain string prefix
      // comparison breaks on Windows, where path.resolve produces backslash-separated
      // paths but a hardcoded "/" separator never matches them.
      const relativeToSrcRoot = relative(SRC_ROOT, resolved);
      if (relativeToSrcRoot.startsWith("..") || isAbsolute(relativeToSrcRoot)) continue;
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

  describe("finalizeWithoutCrossFileResolution", () => {
    const filePath = "Panel.svelte";
    const source = `<script>
  import { createEventDispatcher, setContext } from "svelte";
  import * as keys from "./keys.js";
  import * as ns from "./ns.js";
  import { DELAY } from "./constants.js";
  import * as C from "./constants.js";
  import { uniqueId } from "./ids.js";
  import * as helpers from "./helpers.js";

  /** @event {string} change */
  /** @event close */
  export let delay = DELAY;
  export let timeout = C.timing.TIMEOUT;
  export let id = uniqueId();
  const dispatch = createEventDispatcher();
  helpers.wire(dispatch);
  setContext(keys.THEME, { dark: true });
  setContext(ns.keys.SIZE, { size: 1 });
</script>
`;

    function parse(text = source) {
      return new ComponentParser().parseSvelteComponent(text, { moduleName: "Panel", filePath });
    }

    function crossFileDiagnostics(parsed: ReturnType<typeof parse>) {
      return (parsed.diagnostics ?? []).filter((diagnostic) => diagnostic.code === "sveld/cross-file-unresolved");
    }

    test("the parser alone records no cross-file-unresolved diagnostics", () => {
      expect(crossFileDiagnostics(parse())).toEqual([]);
    });

    test("records one warning per pending candidate, naming the import", () => {
      const finalized = finalizeWithoutCrossFileResolution(parse(), { filePath });
      const diagnostics = crossFileDiagnostics(finalized);

      expect(diagnostics.map(({ name }) => name).sort()).toEqual(
        ["THEME", "keys.SIZE", "delay", "timeout", "id", "helpers.wire"].sort(),
      );
      for (const diagnostic of diagnostics) {
        expect(diagnostic.kind).toBe("cross-file-unresolved");
        expect(diagnostic.severity).toBe("warning");
        expect(diagnostic.component).toBe(filePath);
        expect(diagnostic.source).toBeDefined();
      }

      const messageFor = (name: string) => diagnostics.find((diagnostic) => diagnostic.name === name)?.message;
      expect(messageFor("THEME")).toContain('setContext key `THEME` is imported from "./keys.js"');
      expect(messageFor("THEME")).toContain("the context is omitted");
      expect(messageFor("keys.SIZE")).toContain('setContext key `keys.SIZE` is imported from "./ns.js"');
      expect(messageFor("delay")).toContain('`DELAY` imported from "./constants.js"');
      expect(messageFor("timeout")).toContain('`timing.TIMEOUT` imported from "./constants.js"');
      expect(messageFor("id")).toContain('`uniqueId()` imported from "./ids.js"');
      expect(messageFor("helpers.wire")).toContain(
        '`dispatch` is passed to `helpers.wire`, imported from "./helpers.js"',
      );
      for (const diagnostic of diagnostics) {
        expect(diagnostic.message).toContain("file access");
      }
    });

    test("releases the held-back event-no-source diagnostics", () => {
      const parsed = parse();
      expect((parsed.diagnostics ?? []).filter((d) => d.kind === "event-no-source")).toEqual([]);

      const released = (finalizeWithoutCrossFileResolution(parsed, { filePath }).diagnostics ?? []).filter(
        (diagnostic) => diagnostic.kind === "event-no-source",
      );
      expect(released.map(({ name }) => name).sort()).toEqual(["change", "close"]);
      for (const diagnostic of released) {
        expect(diagnostic.message).toContain("`helpers.wire`");
      }
    });

    test("returns a new component and leaves the parse untouched; a second call adds nothing", () => {
      const parsed = parse();
      const before = structuredClone(parsed.diagnostics);
      const once = finalizeWithoutCrossFileResolution(parsed, { filePath });
      const twice = finalizeWithoutCrossFileResolution(once, { filePath });

      expect(once).not.toBe(parsed);
      expect(parsed.diagnostics).toEqual(before);
      expect(twice.diagnostics).toEqual(once.diagnostics);
    });

    test("keeps the component-level fields a ComponentDocApi carries", () => {
      const component = toComponentDocApi(parse(), "Panel", filePath);
      const finalized = finalizeWithoutCrossFileResolution(component);

      expect(finalized.moduleName).toBe("Panel");
      expect(crossFileDiagnostics(finalized).every((diagnostic) => diagnostic.component === filePath)).toBe(true);
    });

    test("a dispatcher with @sveld-ignore sveld/dispatch-escapes gets an ignored warning", () => {
      const parsed = parse(`<script>
  import { createEventDispatcher } from "svelte";
  import { wire } from "./helpers.js";

  /** @sveld-ignore sveld/dispatch-escapes */
  const dispatch = createEventDispatcher();
  wire(dispatch);
</script>
`);
      const [diagnostic] = crossFileDiagnostics(finalizeWithoutCrossFileResolution(parsed, { filePath }));

      expect(diagnostic?.name).toBe("wire");
      expect(diagnostic?.ignored).toBe(true);
    });

    test("a component with nothing to resolve is returned unchanged", () => {
      const parsed = parse("<script>export let a = 1;</script>");
      const finalized = finalizeWithoutCrossFileResolution(parsed, { filePath });

      expect(finalized.diagnostics).toEqual(parsed.diagnostics);
    });
  });
});
