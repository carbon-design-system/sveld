import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSveld } from "../src/SveldDocumenter";

function createFixture() {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "sveld-documenter-"));
  const srcDir = path.join(fixtureDir, "src");

  mkdirSync(srcDir, { recursive: true });
  writeFileSync(path.join(srcDir, "index.js"), `export { default as Button } from "./Button.svelte";`);
  writeFileSync(
    path.join(srcDir, "Button.svelte"),
    `<script lang="ts">
  /** Button label */
  export let label: string;
</script>

<button>{label}</button>
`,
  );
  writeFileSync(
    path.join(srcDir, "Internal.svelte"),
    `<script lang="ts">
  export let hidden: boolean;
</script>
`,
  );

  return fixtureDir;
}

describe("SveldDocumenter", () => {
  const originalCwd = process.cwd();

  function removeFixtureDir(fixtureDir: string) {
    process.chdir(originalCwd);
    rmSync(fixtureDir, { recursive: true, force: true });
  }

  afterEach(() => {
    process.chdir(originalCwd);
  });

  test("inspect builds the document without writing outputs", async () => {
    const fixtureDir = createFixture();

    try {
      process.chdir(fixtureDir);

      const document = await createSveld().inspect({
        input: "src/index.js",
        glob: true,
      });

      expect(document?.components.has("Button")).toBe(true);
      expect(document?.components.has("Internal")).toBe(false);
      expect(document?.allComponentsForTypes.has("Internal")).toBe(true);
      expect(existsSync(path.join(fixtureDir, "types"))).toBe(false);
      expect(existsSync(path.join(fixtureDir, "COMPONENT_API.json"))).toBe(false);
      expect(existsSync(path.join(fixtureDir, "COMPONENT_INDEX.md"))).toBe(false);
    } finally {
      removeFixtureDir(fixtureDir);
    }
  });

  test("write awaits all selected output files", async () => {
    const fixtureDir = createFixture();

    try {
      process.chdir(fixtureDir);

      const result = await createSveld().write({
        input: "src/index.js",
        glob: true,
        types: true,
        json: true,
        markdown: true,
      });

      const typesIndexPath = path.join(fixtureDir, "types", "index.d.ts");
      const internalTypesPath = path.join(fixtureDir, "types", "Internal.svelte.d.ts");
      const jsonPath = path.join(fixtureDir, "COMPONENT_API.json");
      const markdownPath = path.join(fixtureDir, "COMPONENT_INDEX.md");

      expect(result?.written).toEqual(["types", "json", "markdown"]);
      expect(existsSync(typesIndexPath)).toBe(true);
      expect(existsSync(internalTypesPath)).toBe(true);
      expect(existsSync(jsonPath)).toBe(true);
      expect(existsSync(markdownPath)).toBe(true);

      const json = JSON.parse(readFileSync(jsonPath, "utf-8"));
      expect(json.components.map((component: { moduleName: string }) => component.moduleName)).toEqual(["Button"]);
      expect(readFileSync(markdownPath, "utf-8")).toContain("`Button`");
      expect(readFileSync(markdownPath, "utf-8")).not.toContain("`Internal`");
    } finally {
      removeFixtureDir(fixtureDir);
    }
  });

  test("createSveld accepts adapters at the documenter seam", async () => {
    const bundle = {
      exports: {},
      components: new Map(),
      allComponentsForTypes: new Map(),
    };
    const generateBundle = jest.fn(async () => bundle);
    const writeOutput = jest.fn(async () => ["types" as const]);

    const result = await createSveld({
      resolveInput: () => "src/index.js",
      generateBundle,
      writeOutput,
    }).write({
      types: true,
    });

    expect(generateBundle).toHaveBeenCalledWith("src/index.js", false);
    expect(writeOutput).toHaveBeenCalledWith(expect.objectContaining(bundle), { types: true }, "src/index.js");
    expect(result?.written).toEqual(["types"]);
  });
});
