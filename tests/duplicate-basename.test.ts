import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { generateBundle } from "../src/bundle";
import writeTsDefinitions from "../src/writer/writer-ts-definitions";

/**
 * `--glob` used to index by basename, so two `Menu.svelte` files in different
 * folders collapsed into one `.d.ts` entry. Walk order decided the winner and
 * varied by OS.
 */
describe("duplicate basenames discovered via glob", () => {
  let dir: string;
  let outDirAbs: string;
  let outDir: string;
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-dup-basename-"));
    // writeTsDefinitions joins its index.d.ts path onto process.cwd() regardless
    // of whether outDir is already absolute, so outDir must be relative to cwd.
    outDirAbs = mkdtempSync(join(process.cwd(), ".tmp-sveld-dup-basename-out-"));
    outDir = relative(process.cwd(), outDirAbs);

    mkdirSync(join(dir, "Menu"), { recursive: true });
    mkdirSync(join(dir, "icons"), { recursive: true });

    writeFileSync(join(dir, "index.js"), `export { default as Menu } from "./Menu/Menu.svelte";\n`);
    writeFileSync(
      join(dir, "Menu", "Menu.svelte"),
      "<script>\n  export let anchor = null;\n</script>\n\n<nav>{anchor}</nav>\n",
    );
    writeFileSync(
      join(dir, "icons", "Menu.svelte"),
      "<script>\n  export let size = 16;\n</script>\n\n<svg width={size} height={size} />\n",
    );

    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
    rmSync(outDirAbs, { recursive: true, force: true });
  });

  test("both components survive in allComponentsForTypes, not just the last one walked", async () => {
    const result = await generateBundle(join(dir, "index.js"), true);

    const menus = Array.from(result.allComponentsForTypes.values()).filter((c) => c.moduleName === "Menu");
    expect(menus).toHaveLength(2);

    const realMenu = menus.find((c) => c.filePath.endsWith("Menu/Menu.svelte"));
    const iconMenu = menus.find((c) => c.filePath.endsWith("icons/Menu.svelte"));

    expect(realMenu?.props.map((p) => p.name)).toEqual(["anchor"]);
    expect(iconMenu?.props.map((p) => p.name)).toEqual(["size"]);
  });

  test("the barrel export's source still points at the real component, not the icon", async () => {
    const result = await generateBundle(join(dir, "index.js"), true);

    expect(result.exports.Menu.source).toBe("./Menu/Menu.svelte");

    const exportedMenu = result.components.get("Menu");
    expect(exportedMenu?.filePath).toBe("./Menu/Menu.svelte");
    expect(exportedMenu?.props.map((p) => p.name)).toEqual(["anchor"]);
  });

  test("warns once about the duplicate name", async () => {
    await generateBundle(join(dir, "index.js"), true);

    const duplicateWarnings = warnSpy.mock.calls.filter((call: unknown[]) =>
      String(call[0]).includes('multiple components named "Menu"'),
    );
    expect(duplicateWarnings).toHaveLength(1);
  });

  test("writes a .d.ts file for both components", async () => {
    const result = await generateBundle(join(dir, "index.js"), true);
    await writeTsDefinitions(result.allComponentsForTypes, {
      outDir,
      inputDir: dir,
      preamble: "",
      exports: result.exports,
    });

    const realMenuDts = resolve(outDirAbs, "Menu", "Menu.svelte.d.ts");
    const iconMenuDts = resolve(outDirAbs, "icons", "Menu.svelte.d.ts");

    expect(existsSync(realMenuDts)).toBe(true);
    expect(existsSync(iconMenuDts)).toBe(true);

    expect(readFileSync(realMenuDts, "utf-8")).toContain("anchor");
    expect(readFileSync(iconMenuDts, "utf-8")).toContain("size");
  });
});

/**
 * Directory barrel re-exports like `export { X } from "./dir"` still resolve
 * through the glob walk to the real `.svelte` file. A same-named file in
 * another folder must not steal that resolution.
 */
describe("directory-style barrel re-exports still resolve via glob", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-dir-reexport-"));
    mkdirSync(join(dir, "button"), { recursive: true });

    writeFileSync(join(dir, "index.js"), `export { Button } from "./button/";\n`);
    writeFileSync(join(dir, "button", "index.js"), `export { default as Button } from "./Button.svelte";\n`);
    writeFileSync(
      join(dir, "button", "Button.svelte"),
      `<script>\n  export let label = "button";\n</script>\n\n<button>{label}</button>\n`,
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("resolves the directory export to the concrete file found by glob", async () => {
    const result = await generateBundle(join(dir, "index.js"), true);

    expect(result.exports.Button.source).toBe("./button/Button.svelte");
    expect(result.components.get("Button")?.props.map((p) => p.name)).toEqual(["label"]);
  });
});
