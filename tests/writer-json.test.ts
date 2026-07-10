import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { version as svelteVersion } from "svelte/package.json";
import { name as packageName, version as packageVersion } from "../package.json";
import { setQuiet } from "../src/logger";
import type { ComponentDocApi, ComponentDocs } from "../src/plugin";
import writeJson from "../src/writer/writer-json";
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
