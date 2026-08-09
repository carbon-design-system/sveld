import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { version as svelteVersion } from "svelte/package.json";
import { name as packageName, version as packageVersion } from "../package.json";
import { setQuiet } from "../src/logger";
import type { ComponentDocApi, ComponentDocs } from "../src/plugin";
import writeJson, { renderJsonDocument } from "../src/writer/writer-json";
import { mockComponentDocApi } from "./test-brands";

function createComponent(moduleName: string, filePath: string) {
  return mockComponentDocApi(moduleName, filePath);
}

describe("writeJson", () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setQuiet(false);
    jest.restoreAllMocks();
  });

  test("writes schema and generator metadata to combined JSON output", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-json-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "COMPONENT_API.json"));
    const components: ComponentDocs = new Map([
      ["Zeta", createComponent("Zeta", "Zeta.svelte")],
      ["Alpha", createComponent("Alpha", "Alpha.svelte")],
    ]);

    try {
      await writeJson(components, {
        input: "src",
        inputDir: "src",
        outFile,
      });

      const output = JSON.parse(readFileSync(path.join(tempDir, "COMPONENT_API.json"), "utf-8"));

      expect(output).toMatchObject({
        schemaVersion: 1,
        generator: {
          name: packageName,
          version: packageVersion,
          svelteVersion,
        },
        total: 2,
      });
      expect(output.components.map((component: ComponentDocApi) => component.moduleName)).toEqual(["Alpha", "Zeta"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("omits entry exports collection when documentExports is off", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-json-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "COMPONENT_API.json"));
    const components: ComponentDocs = new Map([["Alpha", createComponent("Alpha", "Alpha.svelte")]]);

    try {
      await writeJson(components, { input: "src", inputDir: "src", outFile });

      const output = JSON.parse(readFileSync(path.join(tempDir, "COMPONENT_API.json"), "utf-8"));
      expect(output.exports).toBeUndefined();
      expect(output.totalExports).toBeUndefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("writes the entry exports collection when provided", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-json-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "COMPONENT_API.json"));
    const components: ComponentDocs = new Map([["Alpha", createComponent("Alpha", "Alpha.svelte")]]);

    try {
      await writeJson(components, {
        input: "src",
        inputDir: "src",
        outFile,
        entryExports: [
          {
            name: "VERSION",
            kind: "const",
            type: "string",
            value: '"1.0.0"',
            isTypeOnly: false,
            source: "./constants.ts",
          },
          { name: "Theme", kind: "type", type: '"light" | "dark"', isTypeOnly: true, source: "./types.ts" },
        ],
      });

      const output = JSON.parse(readFileSync(path.join(tempDir, "COMPONENT_API.json"), "utf-8"));
      expect(output.totalExports).toBe(2);
      expect(output.exports).toEqual([
        {
          name: "VERSION",
          kind: "const",
          type: "string",
          value: '"1.0.0"',
          isTypeOnly: false,
          source: "./constants.ts",
        },
        { name: "Theme", kind: "type", type: '"light" | "dark"', isTypeOnly: true, source: "./types.ts" },
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("prints the progress line to stderr", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-json-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "COMPONENT_API.json"));

    try {
      await writeJson(new Map([["Alpha", createComponent("Alpha", "Alpha.svelte")]]), {
        input: "src",
        inputDir: "src",
        outFile,
      });

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`created "${outFile}".`));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("suppresses the progress line when quiet mode is on", async () => {
    setQuiet(true);
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-json-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "COMPONENT_API.json"));

    try {
      await writeJson(new Map([["Alpha", createComponent("Alpha", "Alpha.svelte")]]), {
        input: "src",
        inputDir: "src",
        outFile,
      });

      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("writeJson (outDir mode, one file per component)", () => {
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("names each file after moduleName when names are unique", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-json-outdir-"));
    const outDir = path.relative(process.cwd(), tempDir);
    const components: ComponentDocs = new Map([
      ["Zeta", createComponent("Zeta", "Zeta.svelte")],
      ["Alpha", createComponent("Alpha", "Alpha.svelte")],
    ]);

    try {
      await writeJson(components, { input: "src", inputDir: "src", outFile: "COMPONENT_API.json", outDir });

      expect(JSON.parse(readFileSync(path.join(tempDir, "Zeta.api.json"), "utf-8")).moduleName).toBe("Zeta");
      expect(JSON.parse(readFileSync(path.join(tempDir, "Alpha.api.json"), "utf-8")).moduleName).toBe("Alpha");
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("keys colliding moduleNames by source path instead of silently overwriting", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-json-outdir-"));
    const outDir = path.relative(process.cwd(), tempDir);
    // Same basename in different dirs; the collision #402 fixed elsewhere.
    const components: ComponentDocs = new Map([
      ["Menu/Menu.svelte", createComponent("Menu", "Menu/Menu.svelte")],
      ["icons/Menu.svelte", createComponent("Menu", "icons/Menu.svelte")],
    ]);

    try {
      await writeJson(components, { input: "src", inputDir: "src", outFile: "COMPONENT_API.json", outDir });

      // Flat Menu.api.json must not exist; each file lives under its source path.
      expect(() => readFileSync(path.join(tempDir, "Menu.api.json"), "utf-8")).toThrow();

      const realMenu = JSON.parse(readFileSync(path.join(tempDir, "src", "Menu", "Menu.api.json"), "utf-8"));
      const iconMenu = JSON.parse(readFileSync(path.join(tempDir, "src", "icons", "Menu.api.json"), "utf-8"));
      expect(realMenu.moduleName).toBe("Menu");
      expect(realMenu.filePath).toBe("src/Menu/Menu.svelte");
      expect(iconMenu.moduleName).toBe("Menu");
      expect(iconMenu.filePath).toBe("src/icons/Menu.svelte");

      const duplicateWarnings = warnSpy.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes('multiple components named "Menu"'),
      );
      expect(duplicateWarnings).toHaveLength(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("renderJsonDocument", () => {
  test("matches the document writeJson writes to disk, without touching disk", async () => {
    const components: ComponentDocs = new Map([
      ["Zeta", createComponent("Zeta", "Zeta.svelte")],
      ["Alpha", createComponent("Alpha", "Alpha.svelte")],
    ]);

    const rendered = renderJsonDocument(components, { inputDir: "src" });

    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-json-render-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "COMPONENT_API.json"));

    try {
      await writeJson(components, { input: "src", inputDir: "src", outFile });
      const written = readFileSync(path.join(tempDir, "COMPONENT_API.json"), "utf-8");

      expect(rendered).toBe(written);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("includes schemaVersion and generator metadata", () => {
    const components: ComponentDocs = new Map([["Alpha", createComponent("Alpha", "Alpha.svelte")]]);

    const rendered = JSON.parse(renderJsonDocument(components, { inputDir: "src" }));

    expect(rendered).toMatchObject({
      schemaVersion: 1,
      generator: { name: packageName, version: packageVersion, svelteVersion },
      total: 1,
    });
  });
});
