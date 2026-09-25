import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SveldDiagnostic } from "../src/diagnostics";
import { type EntryExport, parseEntryExports } from "../src/parse-entry-exports";

const entryFile = path.join(process.cwd(), "tests", "fixtures-entry-exports", "index.ts");

function byName(exports: EntryExport[], name: string): EntryExport {
  const match = exports.find((entry) => entry.name === name);
  if (!match) throw new Error(`Expected an export named "${name}"`);
  return match;
}

describe("parseEntryExports", () => {
  test("documents re-exported consts, functions, and types", async () => {
    const exports = await parseEntryExports(entryFile);
    const names = exports.map((entry) => entry.name);

    // Components are documented separately and excluded here.
    expect(names).not.toContain("Button");

    expect(names).toEqual(
      expect.arrayContaining([
        "VERSION",
        "MAX_RETRIES",
        "clamp",
        "invertTheme",
        "Theme",
        "ThemeConfig",
        "DEFAULT_THEME",
      ]),
    );
  });

  test("documents a re-exported const with its value and JSDoc", async () => {
    const exports = await parseEntryExports(entryFile);

    expect(byName(exports, "VERSION")).toMatchObject({
      name: "VERSION",
      kind: "const",
      type: "string",
      value: '"1.2.3"',
      description: "The current library version.",
      isTypeOnly: false,
    });
  });

  test("copies an explicit const type annotation verbatim", async () => {
    const exports = await parseEntryExports(entryFile);

    expect(byName(exports, "MAX_RETRIES")).toMatchObject({
      name: "MAX_RETRIES",
      kind: "const",
      type: "number",
      isTypeOnly: false,
    });
  });

  test("documents a re-exported function declaration as a signature", async () => {
    const exports = await parseEntryExports(entryFile);

    expect(byName(exports, "clamp")).toMatchObject({
      name: "clamp",
      kind: "function",
      type: "(value: number, min: number, max: number) => number",
      description: "Clamps a number between a lower and upper bound.",
      isTypeOnly: false,
    });
  });

  test("documents a re-exported arrow function const", async () => {
    const exports = await parseEntryExports(entryFile);

    expect(byName(exports, "invertTheme")).toMatchObject({
      name: "invertTheme",
      kind: "const",
      type: "(theme: Theme) => Theme",
      // Only the adjacent JSDoc documents the value; a preceding declaration's
      // comment must not bleed into it.
      description: "Returns the inverse of a theme.",
      isTypeOnly: false,
    });
  });

  test("leaves the description undefined when there is no adjacent JSDoc", async () => {
    const exports = await parseEntryExports(entryFile);
    expect(byName(exports, "MAX_RETRIES").description).toBeUndefined();
  });

  test("documents a re-exported type alias verbatim", async () => {
    const exports = await parseEntryExports(entryFile);

    expect(byName(exports, "Theme")).toMatchObject({
      name: "Theme",
      kind: "type",
      type: '"light" | "dark"',
      isTypeOnly: true,
    });
  });

  test("documents a re-exported interface", async () => {
    const exports = await parseEntryExports(entryFile);
    const themeConfig = byName(exports, "ThemeConfig");

    expect(themeConfig.kind).toBe("interface");
    expect(themeConfig.isTypeOnly).toBe(true);
    expect(themeConfig.type).toContain("theme: Theme");
    expect(themeConfig.type).toContain("persist: boolean");
  });

  test("documents an inline const declaration on the entry", async () => {
    const exports = await parseEntryExports(entryFile);

    expect(byName(exports, "DEFAULT_THEME")).toMatchObject({
      name: "DEFAULT_THEME",
      kind: "const",
      value: '"light"',
      description: "Default theme applied when none is configured.",
      isTypeOnly: false,
    });
  });

  test("captures @deprecated and pass-through tags on an entry export", async () => {
    const exports = await parseEntryExports(entryFile);

    expect(byName(exports, "DEFAULT_THEME")).toMatchObject({
      deprecated: "Use `invertTheme` with an explicit theme instead.",
      tags: [{ name: "since", body: "1.0.0" }],
    });

    // Exports without either tag stay undefined.
    expect(byName(exports, "VERSION").deprecated).toBeUndefined();
    expect(byName(exports, "VERSION").tags).toBeUndefined();
  });

  test("sorts exports alphabetically and resolves source paths", async () => {
    const exports = await parseEntryExports(entryFile);

    const sorted = [...exports].sort((a, b) => a.name.localeCompare(b.name));
    expect(exports).toEqual(sorted);

    expect(byName(exports, "VERSION").source).toBe("./constants.ts");
    expect(byName(exports, "clamp").source).toBe("./utils.ts");
    expect(byName(exports, "Theme").source).toBe("./types.ts");
    expect(byName(exports, "DEFAULT_THEME").source).toBe("./index.ts");
  });

  test("keeps the implementation signature for an overloaded function re-exported through a barrel", async () => {
    const exports = await parseEntryExports(entryFile);

    expect(byName(exports, "format")).toMatchObject({
      name: "format",
      kind: "function",
      type: "(value: string | number) => string",
    });
  });

  test("records an enum's members as a literal union type", async () => {
    const exports = await parseEntryExports(entryFile);

    expect(byName(exports, "Status")).toMatchObject({
      name: "Status",
      kind: "enum",
      type: '"active" | "inactive"',
    });
    expect(byName(exports, "Priority")).toMatchObject({
      name: "Priority",
      kind: "enum",
      type: "0 | 1 | 2",
    });
  });

  test("`export *` collisions leave the name out and report a diagnostic", async () => {
    // Not written under tests/fixtures-entry-exports because `export * from`
    // trips the repo's own `noReExportAll` lint rule.
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-export-star-collision-"));
    try {
      writeFileSync(path.join(dir, "collide-a.ts"), 'export const SHARED = "a";\nexport const ONLY_A = 1;\n');
      writeFileSync(path.join(dir, "collide-b.ts"), 'export const SHARED = "b";\n');
      writeFileSync(
        path.join(dir, "index.ts"),
        ['export * from "./collide-a";', 'export * from "./collide-b";', ""].join("\n"),
      );

      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const diagnostics: SveldDiagnostic[] = [];

      const exports = await parseEntryExports(path.join(dir, "index.ts"), { diagnostics });

      // ES modules don't export an ambiguous star name at all.
      expect(exports.map((entry) => entry.name)).toEqual(["ONLY_A"]);
      expect(diagnostics).toEqual([
        {
          component: "./index.ts",
          kind: "export-ambiguous",
          code: "sveld/export-ambiguous",
          severity: "warning",
          name: "SHARED",
          message: expect.stringContaining('"./collide-a.ts" and "./collide-b.ts"'),
        },
      ]);
      expect(diagnostics[0].message).toContain('export { SHARED } from "./collide-a.ts"');
      expect(warn).not.toHaveBeenCalled();

      warn.mockRestore();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an `export *` collision in a nested barrel isn't the entry's to report", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-export-star-nested-collision-"));
    try {
      writeFileSync(path.join(dir, "collide-a.ts"), 'export const SHARED = "a";\n');
      writeFileSync(path.join(dir, "collide-b.ts"), 'export const SHARED = "b";\n');
      writeFileSync(
        path.join(dir, "nested.ts"),
        ['export * from "./collide-a";', 'export * from "./collide-b";', "export const NESTED = 1;", ""].join("\n"),
      );
      writeFileSync(path.join(dir, "index.ts"), 'export * from "./nested";\n');

      const diagnostics: SveldDiagnostic[] = [];
      const exports = await parseEntryExports(path.join(dir, "index.ts"), { diagnostics });

      expect(exports.map((entry) => entry.name)).toEqual(["NESTED"]);
      expect(diagnostics).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an explicit re-export resolves an `export *` collision silently", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-export-star-explicit-"));
    try {
      writeFileSync(path.join(dir, "collide-a.ts"), 'export const SHARED = "a";\n');
      writeFileSync(path.join(dir, "collide-b.ts"), 'export const SHARED = "b";\n');
      writeFileSync(
        path.join(dir, "index.ts"),
        [
          'export * from "./collide-a";',
          'export * from "./collide-b";',
          'export { SHARED } from "./collide-b";',
          "",
        ].join("\n"),
      );

      const diagnostics: SveldDiagnostic[] = [];
      const exports = await parseEntryExports(path.join(dir, "index.ts"), { diagnostics });

      expect(byName(exports, "SHARED")).toMatchObject({ value: '"b"', source: "./collide-b.ts" });
      expect(diagnostics).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the barrel's own export beats an `export *` of the same name, without a warning", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-export-star-shadow-"));
    try {
      writeFileSync(path.join(dir, "star.ts"), 'export const SHARED = "star";\nexport const OTHER = 1;\n');
      writeFileSync(
        path.join(dir, "index.ts"),
        ['export * from "./star";', 'export const SHARED = "own";', ""].join("\n"),
      );

      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

      const exports = await parseEntryExports(path.join(dir, "index.ts"));

      expect(byName(exports, "SHARED")).toMatchObject({ value: '"own"', source: "./index.ts" });
      expect(byName(exports, "OTHER")).toMatchObject({ source: "./star.ts" });
      expect(warn).not.toHaveBeenCalled();

      warn.mockRestore();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("lists a namespace re-export as one name, not the names inside it", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-namespace-"));
    try {
      writeFileSync(path.join(dir, "utils.ts"), "export const clamp = 1;\nexport type Size = number;\n");
      writeFileSync(path.join(dir, "local.ts"), "export const local = 1;\n");
      mkdirSync(path.join(dir, "lib"));
      writeFileSync(path.join(dir, "lib", "math.ts"), "export const add = 1;\n");
      writeFileSync(path.join(dir, "lib", "index.ts"), 'export * as math from "./math";\n');
      writeFileSync(
        path.join(dir, "index.ts"),
        [
          'export * as utils from "./utils";',
          'export type * as types from "./utils";',
          'import * as localNs from "./local";',
          "export { localNs };",
          'export { math } from "./lib";',
          "",
        ].join("\n"),
      );

      const exports = await parseEntryExports(path.join(dir, "index.ts"));

      // The type names the wrapped module relative to the entry, even when
      // the namespace comes through a nested barrel.
      expect(exports).toEqual([
        {
          name: "localNs",
          kind: "const",
          type: 'typeof import("./local.ts")',
          source: "./local.ts",
          isTypeOnly: false,
        },
        {
          name: "math",
          kind: "const",
          type: 'typeof import("./lib/math.ts")',
          source: "./lib/math.ts",
          isTypeOnly: false,
        },
        {
          name: "types",
          kind: "const",
          type: 'typeof import("./utils.ts")',
          source: "./utils.ts",
          isTypeOnly: true,
        },
        {
          name: "utils",
          kind: "const",
          type: 'typeof import("./utils.ts")',
          source: "./utils.ts",
          isTypeOnly: false,
        },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("documents a default export re-exported by name, and skips one it can't read", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-default-reexport-"));
    try {
      writeFileSync(path.join(dir, "track.ts"), "export default function track(id: string): void {}\n");
      writeFileSync(path.join(dir, "config.ts"), "export default { retries: 3 };\n");
      writeFileSync(
        path.join(dir, "index.ts"),
        [
          'export { default as track } from "./track";',
          'export { default as config } from "./config";',
          'export { default } from "./track";',
          "",
        ].join("\n"),
      );

      const exports = await parseEntryExports(path.join(dir, "index.ts"));

      expect(exports).toEqual([
        { name: "track", kind: "function", type: "(id: string) => void", source: "./track.ts", isTypeOnly: false },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("documents a default-exported class or function like a named one", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-default-class-"));
    try {
      writeFileSync(path.join(dir, "foo.ts"), "/** A foo. */\nexport default class Foo {}\n");
      writeFileSync(path.join(dir, "bar.ts"), "/** A bar. */\nexport class Bar {}\n");
      writeFileSync(path.join(dir, "anon.ts"), "/** Unnamed. */\nexport default class {}\n");
      writeFileSync(
        path.join(dir, "track.ts"),
        "/**\n * Tracks an id.\n * @since 1.0.0\n */\nexport default function track(id: string): void {}\n",
      );
      writeFileSync(path.join(dir, "log.ts"), "/** Logs an id. */\nexport function log(id: string): void {}\n");
      writeFileSync(
        path.join(dir, "index.ts"),
        [
          'export { default as Foo } from "./foo";',
          'export { Bar } from "./bar";',
          'export { default as Anon } from "./anon";',
          'export { default as track } from "./track";',
          'export { log } from "./log";',
          "",
        ].join("\n"),
      );

      const exports = await parseEntryExports(path.join(dir, "index.ts"));

      expect(exports).toEqual([
        { name: "Anon", kind: "class", description: "Unnamed.", source: "./anon.ts", isTypeOnly: false },
        { name: "Bar", kind: "class", type: "Bar", description: "A bar.", source: "./bar.ts", isTypeOnly: false },
        { name: "Foo", kind: "class", type: "Foo", description: "A foo.", source: "./foo.ts", isTypeOnly: false },
        {
          name: "log",
          kind: "function",
          type: "(id: string) => void",
          description: "Logs an id.",
          source: "./log.ts",
          isTypeOnly: false,
        },
        {
          name: "track",
          kind: "function",
          type: "(id: string) => void",
          description: "Tracks an id.",
          tags: [{ name: "since", body: "1.0.0" }],
          source: "./track.ts",
          isTypeOnly: false,
        },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("skips components re-exported through a nested barrel", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-nested-component-"));
    try {
      mkdirSync(path.join(dir, "dir"));
      writeFileSync(path.join(dir, "dir", "X.svelte"), "<div />\n");
      writeFileSync(path.join(dir, "dir", "Y.svelte"), "<div />\n");
      writeFileSync(path.join(dir, "dir", "Z.svelte"), "<div />\n");
      writeFileSync(
        path.join(dir, "dir", "index.ts"),
        [
          'export { default as X } from "./X.svelte";',
          'import Y from "./Y.svelte";',
          "export { Y };",
          'export { default as Z } from "./Z.svelte";',
          "",
        ].join("\n"),
      );
      writeFileSync(path.join(dir, "star.ts"), 'export * from "./dir";\n');
      writeFileSync(
        path.join(dir, "index.ts"),
        ['export { X, Y } from "./dir";', 'export { Z } from "./star";', 'export const VERSION = "1";', ""].join("\n"),
      );

      const exports = await parseEntryExports(path.join(dir, "index.ts"));

      expect(exports.map((entry) => entry.name)).toEqual(["VERSION"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("keeps a JSDoc block separated from the export by line comments", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-line-comment-"));
    try {
      writeFileSync(
        path.join(dir, "index.ts"),
        [
          "/** Library version */",
          "// eslint-disable-next-line",
          'export const VERSION = "1.0.0";',
          "",
          "/** Clamps a value */",
          "/* istanbul ignore next */",
          "export function clamp(n: number): number {",
          "  return n;",
          "}",
          "",
        ].join("\n"),
      );

      const exports = await parseEntryExports(path.join(dir, "index.ts"));

      expect(exports.map((entry) => [entry.name, entry.description])).toEqual([
        ["clamp", "Clamps a value"],
        ["VERSION", "Library version"],
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("warns and skips a re-exported module the underlying parser can't handle, instead of throwing", async () => {
    // Not written under tests/fixtures-entry-exports because the redeclaration
    // below (valid to acorn-typescript, rejected by tsc/biome) would otherwise
    // trip up `tsc --noEmit` and `biome lint`, which both cover tests/**/*.
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-entry-exports-parse-failure-"));
    try {
      writeFileSync(path.join(dir, "types.ts"), 'export type Theme = "light" | "dark";\n');
      writeFileSync(
        path.join(dir, "theme.ts"),
        [
          'import type { Theme } from "./types";',
          "",
          'export const Theme: { current: Theme } = { current: "light" };',
          "",
        ].join("\n"),
      );
      writeFileSync(path.join(dir, "other.ts"), 'export const VERSION = "1.0.0";\n');
      writeFileSync(
        path.join(dir, "index.ts"),
        ['export { Theme } from "./theme";', 'export { VERSION } from "./other";', ""].join("\n"),
      );

      // Warnings go through the quiet-aware logger, which writes to stderr.
      const warn = jest.spyOn(console, "error").mockImplementation(() => undefined);

      const exports = await parseEntryExports(path.join(dir, "index.ts"));

      // The unaffected module's exports still come through.
      expect(byName(exports, "VERSION")).toMatchObject({ name: "VERSION", kind: "const" });

      // The module the parser can't handle contributes no type info, but the
      // failure is surfaced instead of failing silently.
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("theme.ts"));

      warn.mockRestore();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
