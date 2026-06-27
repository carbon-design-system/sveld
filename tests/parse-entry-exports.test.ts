import path from "node:path";
import { type EntryExport, parseEntryExports } from "../src/parse-entry-exports";

const entryFile = path.join(process.cwd(), "tests", "fixtures-entry-exports", "index.ts");

function byName(exports: EntryExport[], name: string): EntryExport {
  const match = exports.find((entry) => entry.name === name);
  if (!match) throw new Error(`Expected an export named "${name}"`);
  return match;
}

describe("parseEntryExports", () => {
  test("documents re-exported consts, functions, and types", () => {
    const exports = parseEntryExports(entryFile);
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

  test("documents a re-exported const with its value and JSDoc", () => {
    const exports = parseEntryExports(entryFile);

    expect(byName(exports, "VERSION")).toMatchObject({
      name: "VERSION",
      kind: "const",
      type: "string",
      value: '"1.2.3"',
      description: "The current library version.",
      isTypeOnly: false,
    });
  });

  test("copies an explicit const type annotation verbatim", () => {
    const exports = parseEntryExports(entryFile);

    expect(byName(exports, "MAX_RETRIES")).toMatchObject({
      name: "MAX_RETRIES",
      kind: "const",
      type: "number",
      isTypeOnly: false,
    });
  });

  test("documents a re-exported function declaration as a signature", () => {
    const exports = parseEntryExports(entryFile);

    expect(byName(exports, "clamp")).toMatchObject({
      name: "clamp",
      kind: "function",
      type: "(value: number, min: number, max: number) => number",
      description: "Clamps a number between a lower and upper bound.",
      isTypeOnly: false,
    });
  });

  test("documents a re-exported arrow function const", () => {
    const exports = parseEntryExports(entryFile);

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

  test("leaves the description undefined when there is no adjacent JSDoc", () => {
    const exports = parseEntryExports(entryFile);
    expect(byName(exports, "MAX_RETRIES").description).toBeUndefined();
  });

  test("documents a re-exported type alias verbatim", () => {
    const exports = parseEntryExports(entryFile);

    expect(byName(exports, "Theme")).toMatchObject({
      name: "Theme",
      kind: "type",
      type: '"light" | "dark"',
      isTypeOnly: true,
    });
  });

  test("documents a re-exported interface", () => {
    const exports = parseEntryExports(entryFile);
    const themeConfig = byName(exports, "ThemeConfig");

    expect(themeConfig.kind).toBe("interface");
    expect(themeConfig.isTypeOnly).toBe(true);
    expect(themeConfig.type).toContain("theme: Theme");
    expect(themeConfig.type).toContain("persist: boolean");
  });

  test("documents an inline const declaration on the entry", () => {
    const exports = parseEntryExports(entryFile);

    expect(byName(exports, "DEFAULT_THEME")).toMatchObject({
      name: "DEFAULT_THEME",
      kind: "const",
      value: '"light"',
      description: "Default theme applied when none is configured.",
      isTypeOnly: false,
    });
  });

  test("sorts exports alphabetically and resolves source paths", () => {
    const exports = parseEntryExports(entryFile);

    const sorted = [...exports].sort((a, b) => a.name.localeCompare(b.name));
    expect(exports).toEqual(sorted);

    expect(byName(exports, "VERSION").source).toBe("./constants.ts");
    expect(byName(exports, "clamp").source).toBe("./utils.ts");
    expect(byName(exports, "Theme").source).toBe("./types.ts");
    expect(byName(exports, "DEFAULT_THEME").source).toBe("./index.ts");
  });
});
