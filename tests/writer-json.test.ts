import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { version as svelteVersion } from "svelte/package.json";
import { name as packageName, version as packageVersion } from "../package.json";
import type { ComponentDocApi, ComponentDocs } from "../src/plugin";
import writeJson from "../src/writer/writer-json";

function createComponent(moduleName: string, filePath: string): ComponentDocApi {
  return {
    moduleName,
    filePath,
    props: [],
    moduleExports: [],
    slots: [],
    events: [],
    typedefs: [],
    generics: null,
    rest_props: undefined,
  };
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
});
