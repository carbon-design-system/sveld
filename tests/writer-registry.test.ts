import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { getWriter, listWriters, type OutputWriter, registerWriter } from "../src/index";
import type { ComponentDocs, GenerateBundleResult } from "../src/plugin";
import { writeOutput } from "../src/plugin";
import { mockComponentDocApi } from "./test-brands";

interface PlainTextWriterOptions {
  outFile: string;
}

describe("custom writer registration (public API)", () => {
  test("registerWriter makes a writer discoverable via getWriter and listWriters", () => {
    const writer: OutputWriter<PlainTextWriterOptions> = {
      name: "test-registry-discovery-writer",
      write: () => {},
    };

    registerWriter(writer);

    expect(getWriter("test-registry-discovery-writer")).toBe(writer);
    expect(listWriters()).toContainEqual(writer);
  });

  test("a trivial custom writer registered via the public API produces its output file", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-custom-writer-"));
    const outFile = path.join(tempDir, "llms.txt");

    try {
      registerWriter<PlainTextWriterOptions>({
        name: "test-plain-text-writer",
        write: (components, options) => {
          const lines = Array.from(components.values()).map((component) => `- ${component.moduleName}`);
          writeFileSync(options.outFile, lines.join("\n"));
        },
      });

      const components: ComponentDocs = new Map([
        ["Button", mockComponentDocApi("Button", "Button.svelte")],
        ["Alert", mockComponentDocApi("Alert", "Alert.svelte")],
      ]);

      const result: GenerateBundleResult = {
        exports: {},
        entryExports: [],
        components,
        allComponentsForTypes: new Map(),
        errors: [],
        diagnostics: [],
      };

      await writeOutput(
        result,
        { types: false, additionalWriters: { "test-plain-text-writer": { outFile } } },
        "/mock/src/index.js",
      );

      expect(existsSync(outFile)).toBe(true);
      expect(readFileSync(outFile, "utf-8")).toBe("- Button\n- Alert");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
