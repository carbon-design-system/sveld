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
