// @reads tests/fixtures/runes-whole-props-imported/**
import path from "node:path";
import { TypeResolver } from "../src/resolve-types";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "runes-whole-props-imported");

describe("TypeResolver.create failure modes", () => {
  test("reports not-installed when `typescript` cannot be found", async () => {
    const result = await TypeResolver.create(FIXTURE_DIR, {
      importTs: async () => ({ installed: false }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not-installed");
    expect(result.message).toContain("typescript");
    expect(result.message).toContain("TypeScript 7");
  });

  test("reports unsupported-version and names the installed version when below TypeScript 7", async () => {
    const result = await TypeResolver.create(FIXTURE_DIR, {
      importTs: async () => ({ installed: true, version: "5.9.0" }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unsupported-version");
    expect(result.message).toContain("5.9.0");
    expect(result.message).toContain("TypeScript 7");
  });

  test("reports no-tsconfig when TypeScript loads but no tsconfig.json is found", async () => {
    const noTsconfigDir = path.parse(process.cwd()).root;
    const result = await TypeResolver.create(noTsconfigDir, {
      importTs: async () => ({ installed: true, version: "7.0.2", module: {} }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no-tsconfig");
    expect(result.message).toContain("tsconfig.json");
  });
});

describe("TypeResolver API versions", () => {
  const COMPONENT = path.join(FIXTURE_DIR, "input.svelte");
  const sources = [
    { id: "prop:value", name: "value", type: "string", code: "value.trim();", kind: "compile" as const },
  ];

  /** Records the constructor options and snapshot params a fake `API` receives. */
  function fakeModule(version: "7.0" | "7.1") {
    const calls: { options?: Record<string, unknown>; snapshot?: Record<string, unknown> } = {};
    const snapshot = { getDefaultProjectForFile: async () => undefined, dispose: async () => {} };
    const takeSnapshot = async (params: Record<string, unknown>) => {
      calls.snapshot = params;
      return snapshot;
    };
    class API {
      constructor(options: Record<string, unknown>) {
        calls.options = options;
      }
      async close() {}
    }
    Object.assign(
      API.prototype,
      version === "7.1" ? { createSnapshot: takeSnapshot } : { updateSnapshot: takeSnapshot },
    );
    return { calls, module: { API } };
  }

  test("TypeScript 7.1 gets the examples as a filesystem layer, with no host callbacks", async () => {
    const { calls, module } = fakeModule("7.1");
    const created = await TypeResolver.create(FIXTURE_DIR, {
      importTs: async () => ({ installed: true, version: "7.1.0", module }),
    });
    if (!created.ok) throw new Error(created.message);
    await created.resolver.checkExamples([{ moduleName: "Input", filePath: COMPONENT, sources }]);

    expect(calls.options?.fs).toBeUndefined();
    const fileSystem = calls.snapshot?.fileSystem as { kind: string; files: Record<string, string> };
    expect(fileSystem.kind).toBe("layer");
    const [content] = Object.values(fileSystem.files);
    expect(content).toContain("value.trim();");
  });

  test("TypeScript 7.0 gets the examples through host filesystem callbacks", async () => {
    const { calls, module } = fakeModule("7.0");
    const created = await TypeResolver.create(FIXTURE_DIR, {
      importTs: async () => ({ installed: true, version: "7.0.2", module }),
    });
    if (!created.ok) throw new Error(created.message);
    await created.resolver.checkExamples([{ moduleName: "Input", filePath: COMPONENT, sources }]);

    const fs = calls.options?.fs as { readFile: (file: string) => string | undefined };
    const fileChanges = calls.snapshot?.fileChanges as { created: string[] };
    expect(fs.readFile(fileChanges.created[0])).toContain("value.trim();");
  });
});
