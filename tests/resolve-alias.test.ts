import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clearConfigCache, resolvePathAlias, resolvePathAliasAbsolute } from "../src/resolve-alias";

const TEST_DIR = join(import.meta.dir, ".tmp-alias-test");

function setupTestDir(structure: Record<string, string | Record<string, unknown>>) {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });

  for (const [path, content] of Object.entries(structure)) {
    const fullPath = join(TEST_DIR, path);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (typeof content === "string") {
      writeFileSync(fullPath, content);
    } else {
      writeFileSync(fullPath, JSON.stringify(content, null, 2));
    }
  }
}

describe("resolvePathAlias", () => {
  beforeEach(() => {
    clearConfigCache();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    clearConfigCache();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test("returns relative paths unchanged", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./src/lib/*"],
          },
        },
      },
    });

    expect(resolvePathAlias("./components/Button.svelte", TEST_DIR)).toBe("./components/Button.svelte");
    expect(resolvePathAlias("../utils/helper.ts", TEST_DIR)).toBe("../utils/helper.ts");
  });

  test("returns absolute paths unchanged", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./src/lib/*"],
          },
        },
      },
    });

    expect(resolvePathAlias("/absolute/path/to/file.ts", TEST_DIR)).toBe("/absolute/path/to/file.ts");
  });

  test("resolves $lib/* alias pattern to relative path", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./src/lib/*"],
          },
        },
      },
    });

    const result = resolvePathAlias("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe("./src/lib/components/Button.svelte");
  });

  test("resolves $lib/* alias pattern to absolute path", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./src/lib/*"],
          },
        },
      },
    });

    const result = resolvePathAliasAbsolute("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe(join(TEST_DIR, "src/lib/components/Button.svelte"));
  });

  test("resolves exact alias match without wildcard", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            $lib: ["./src/lib"],
          },
        },
      },
    });

    const result = resolvePathAlias("$lib", TEST_DIR);
    expect(result).toBe("./src/lib");
  });

  test("resolves custom aliases", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@components/*": ["./src/components/*"],
            "@utils/*": ["./src/utils/*"],
          },
        },
      },
    });

    const componentResult = resolvePathAlias("@components/Button.svelte", TEST_DIR);
    expect(componentResult).toBe("./src/components/Button.svelte");

    const utilResult = resolvePathAlias("@utils/format.ts", TEST_DIR);
    expect(utilResult).toBe("./src/utils/format.ts");
  });

  test("returns original path when no tsconfig found", () => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    const result = resolvePathAlias("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe("$lib/components/Button.svelte");
  });

  test("returns original path when no paths configured", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          // No paths configured
        },
      },
    });

    const result = resolvePathAlias("$lib/components/Button.svelte", TEST_DIR);
    // Should return original since no paths are configured
    expect(result).toBe("$lib/components/Button.svelte");
  });

  test("handles jsconfig.json instead of tsconfig.json", () => {
    setupTestDir({
      "jsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./src/lib/*"],
          },
        },
      },
    });

    const result = resolvePathAlias("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe("./src/lib/components/Button.svelte");
  });

  test("resolves aliases with custom baseUrl", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: "./src",
          paths: {
            "~/*": ["./*"],
          },
        },
      },
    });

    const result = resolvePathAlias("~/components/Button.svelte", TEST_DIR);
    expect(result).toBe("./src/components/Button.svelte");
  });

  test("handles extends in tsconfig", () => {
    setupTestDir({
      "tsconfig.base.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./src/lib/*"],
          },
        },
      },
      "tsconfig.json": {
        extends: "./tsconfig.base.json",
        compilerOptions: {
          paths: {
            "@components/*": ["./src/components/*"],
          },
        },
      },
    });

    // Both base and extended paths should work
    const libResult = resolvePathAlias("$lib/utils/helper.ts", TEST_DIR);
    expect(libResult).toBe("./src/lib/utils/helper.ts");

    const componentResult = resolvePathAlias("@components/Button.svelte", TEST_DIR);
    expect(componentResult).toBe("./src/components/Button.svelte");
  });

  test("finds tsconfig in parent directory", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./src/lib/*"],
          },
        },
      },
    });

    const subDir = join(TEST_DIR, "src/components");
    mkdirSync(subDir, { recursive: true });

    const result = resolvePathAlias("$lib/utils/helper.ts", subDir);
    // Should resolve relative to the subDir
    expect(result).toBe("../lib/utils/helper.ts");
  });

  test("handles invalid JSON gracefully", () => {
    setupTestDir({
      "tsconfig.json": "{ invalid json }",
    });

    const result = resolvePathAlias("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe("$lib/components/Button.svelte");
  });

  test("handles tsconfig with comments", () => {
    setupTestDir({
      "tsconfig.json": `{
        // This is a comment
        "compilerOptions": {
          "baseUrl": ".",
          /* Block comment */
          "paths": {
            "$lib/*": ["./src/lib/*"] // Trailing comment
          }
        }
      }`,
    });

    const result = resolvePathAlias("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe("./src/lib/components/Button.svelte");
  });

  test("uses first mapping when multiple are defined", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./src/lib/*", "./lib/*"],
          },
        },
      },
    });

    const result = resolvePathAlias("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe("./src/lib/components/Button.svelte");
  });
});
