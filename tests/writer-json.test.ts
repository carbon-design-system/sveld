import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { version as svelteVersion } from "svelte/package.json";
import { name as packageName, version as packageVersion } from "../package.json";
import type { ComponentDocApi, ComponentDocs } from "../src/plugin";
import writeJson from "../src/writer/writer-json";
import { mockComponentDocApi } from "./test-brands";

function createComponent(moduleName: string, filePath: string) {
  return mockComponentDocApi(moduleName, filePath);
}

describe("writeJson", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
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
});
