import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { getWriter, listWriters, type OutputWriter, registerWriter } from "../src/index";
import type { ComponentDocs, GenerateBundleResult } from "../src/plugin";
import { writeOutput } from "../src/plugin";
// Side-effect import: registers the built-in "json"/"markdown"/"types"/"custom-elements"/"llms" writers.
import "../src/writer/built-in-writers";
import { mockComponentDocApi } from "./test-brands";

interface PlainTextWriterOptions {
  outFile: string;
}

const DUPLICATE_WRITER_ERROR_REGEX = /test-registry-duplicate-writer.*already registered/;

describe("built-in writers", () => {
  test("registers json, markdown, types, custom-elements, and llms", () => {
    const names = listWriters().map((writer) => writer.name);
    expect(names).toEqual(expect.arrayContaining(["json", "markdown", "types", "custom-elements", "llms"]));
    expect(getWriter("llms")?.componentSet).toBe("exported");
  });
});

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

  test("registerWriter throws on a duplicate name, without replacing the original", () => {
    const original: OutputWriter<PlainTextWriterOptions> = {
      name: "test-registry-duplicate-writer",
      write: () => {},
    };
    const duplicate: OutputWriter<PlainTextWriterOptions> = {
      name: "test-registry-duplicate-writer",
      write: () => {},
    };

    registerWriter(original);

    expect(() => registerWriter(duplicate)).toThrow(DUPLICATE_WRITER_ERROR_REGEX);
    expect(getWriter("test-registry-duplicate-writer")).toBe(original);
  });

  test("registerWriter overwrites a duplicate name when replace: true is passed", () => {
    const original: OutputWriter<PlainTextWriterOptions> = {
      name: "test-registry-replace-writer",
      write: () => {},
    };
    const replacement: OutputWriter<PlainTextWriterOptions> = {
      name: "test-registry-replace-writer",
      write: () => {},
    };

    registerWriter(original);
    registerWriter(replacement, { replace: true });

    expect(getWriter("test-registry-replace-writer")).toBe(replacement);
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

  function makeResult(): GenerateBundleResult {
    return {
      exports: {},
      entryExports: [],
      components: new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]),
      allComponentsForTypes: new Map(),
      errors: [],
      diagnostics: [],
    };
  }

  test("attributes a synchronous throw in a custom writer to its registered name", async () => {
    registerWriter({
      name: "test-sync-throwing-writer",
      write: () => {
        throw new Error("boom");
      },
    });

    await expect(
      writeOutput(
        makeResult(),
        { types: false, additionalWriters: { "test-sync-throwing-writer": {} } },
        "/mock/src/index.js",
      ),
    ).rejects.toThrow('sveld: writer "test-sync-throwing-writer" failed: boom');
  });

  test("attributes an async rejection in a custom writer to its registered name, with the original error as cause", async () => {
    const original = new Error("async boom");
    registerWriter({
      name: "test-async-throwing-writer",
      write: async () => {
        throw original;
      },
    });

    const promise = writeOutput(
      makeResult(),
      { types: false, additionalWriters: { "test-async-throwing-writer": {} } },
      "/mock/src/index.js",
    );

    await expect(promise).rejects.toThrow('sveld: writer "test-async-throwing-writer" failed: async boom');
    await promise.catch((error: Error) => {
      expect(error.cause).toBe(original);
    });
  });

  test("a throwing custom writer doesn't stop sibling writers in the same run", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-custom-writer-sibling-"));
    const outFile = path.join(tempDir, "sibling.txt");

    try {
      registerWriter({
        name: "test-sibling-throwing-writer",
        write: () => {
          throw new Error("boom");
        },
      });
      registerWriter<PlainTextWriterOptions>({
        name: "test-sibling-ok-writer",
        write: (_components, options) => {
          writeFileSync(options.outFile, "ok");
        },
      });

      await expect(
        writeOutput(
          makeResult(),
          {
            types: false,
            additionalWriters: {
              "test-sibling-throwing-writer": {},
              "test-sibling-ok-writer": { outFile },
            },
          },
          "/mock/src/index.js",
        ),
      ).rejects.toThrow();

      expect(existsSync(outFile)).toBe(true);
      expect(readFileSync(outFile, "utf-8")).toBe("ok");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("passes dryRun through to a custom writer's options", async () => {
    let received: boolean | undefined;
    registerWriter<{ dryRun?: boolean }>({
      name: "test-dry-run-writer",
      write: (_components, options) => {
        received = options.dryRun;
      },
    });

    await writeOutput(
      makeResult(),
      { types: false, dryRun: true, additionalWriters: { "test-dry-run-writer": {} } },
      "/mock/src/index.js",
    );

    expect(received).toBe(true);
  });
});
