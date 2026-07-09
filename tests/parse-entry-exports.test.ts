import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

  test("sorts exports alphabetically and resolves source paths", async () => {
    const exports = await parseEntryExports(entryFile);

    const sorted = [...exports].sort((a, b) => a.name.localeCompare(b.name));
    expect(exports).toEqual(sorted);

    expect(byName(exports, "VERSION").source).toBe("./constants.ts");
    expect(byName(exports, "clamp").source).toBe("./utils.ts");
    expect(byName(exports, "Theme").source).toBe("./types.ts");
    expect(byName(exports, "DEFAULT_THEME").source).toBe("./index.ts");
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

      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

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
