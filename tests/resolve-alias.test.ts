import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PathAliases } from "../src/resolve-alias";

const TEST_DIR = join(import.meta.dir, ".tmp-alias-test");

function setupTestDir(structure: Record<string, string | Record<string, unknown>>) {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });

  for (const [path, content] of Object.entries(structure)) {
    const fullPath = join(TEST_DIR, path);
    const dir = dirname(fullPath);

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

describe("PathAliases", () => {
  let aliases: PathAliases;

  beforeEach(() => {
    // A fresh instance per test: `TEST_DIR` is reused, and an instance reads each config once.
    aliases = new PathAliases();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
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

    expect(aliases.relative("./components/Button.svelte", TEST_DIR)).toBe("./components/Button.svelte");
    expect(aliases.relative("../utils/helper.ts", TEST_DIR)).toBe("../utils/helper.ts");
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

    expect(aliases.relative("/absolute/path/to/file.ts", TEST_DIR)).toBe("/absolute/path/to/file.ts");
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

    const result = aliases.relative("$lib/components/Button.svelte", TEST_DIR);
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

    const result = aliases.absolute("$lib/components/Button.svelte", TEST_DIR);
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

    const result = aliases.relative("$lib", TEST_DIR);
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

    const componentResult = aliases.relative("@components/Button.svelte", TEST_DIR);
    expect(componentResult).toBe("./src/components/Button.svelte");

    const utilResult = aliases.relative("@utils/format.ts", TEST_DIR);
    expect(utilResult).toBe("./src/utils/format.ts");
  });

  test("returns original path when no tsconfig found", () => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    const result = aliases.relative("$lib/components/Button.svelte", TEST_DIR);
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

    const result = aliases.relative("$lib/components/Button.svelte", TEST_DIR);
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

    const result = aliases.relative("$lib/components/Button.svelte", TEST_DIR);
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

    const result = aliases.relative("~/components/Button.svelte", TEST_DIR);
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
    const libResult = aliases.relative("$lib/utils/helper.ts", TEST_DIR);
    expect(libResult).toBe("./src/lib/utils/helper.ts");

    const componentResult = aliases.relative("@components/Button.svelte", TEST_DIR);
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

    const result = aliases.relative("$lib/utils/helper.ts", subDir);
    // Should resolve relative to the subDir
    expect(result).toBe("../lib/utils/helper.ts");
  });

  test("handles invalid JSON gracefully", () => {
    setupTestDir({
      "tsconfig.json": "{ invalid json }",
    });

    const result = aliases.relative("$lib/components/Button.svelte", TEST_DIR);
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

    const result = aliases.relative("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe("./src/lib/components/Button.svelte");
  });

  test("parses valid tsconfig without stripping /* inside strings", () => {
    setupTestDir({
      "tsconfig.json": `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "$lib": ["./src/lib"],
      "$lib/*": ["./src/lib/*"]
    }
  },
  "include": ["src/**/*", "test/**/*", "types/**/*"]
}`,
    });

    const subDir = join(TEST_DIR, "src");
    mkdirSync(subDir, { recursive: true });

    const result = aliases.relative("$lib/components/Button.svelte", subDir);
    expect(result).toBe("./lib/components/Button.svelte");
  });

  test("uses first mapping when multiple are defined and neither exists on disk", () => {
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

    const result = aliases.relative("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe("./src/lib/components/Button.svelte");
  });

  test("falls back to a later mapping whose target exists on disk", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./src/lib/*", "./lib/*"],
          },
        },
      },
      "lib/Button.svelte": "<div />",
    });

    const result = aliases.relative("$lib/Button.svelte", TEST_DIR);
    expect(result).toBe("./lib/Button.svelte");
  });

  test("prefers the longest non-wildcard prefix over declaration order", () => {
    setupTestDir({
      "tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "$lib/*": ["./generic/*"],
            "$lib/components/*": ["./special/*"],
          },
        },
      },
    });

    const result = aliases.relative("$lib/components/Button.svelte", TEST_DIR);
    expect(result).toBe("./special/Button.svelte");
  });

  test("reports an unresolved alias when no tsconfig/jsconfig exists", () => {
    const result = aliases.lookup("$lib/Button.svelte", TEST_DIR);
    expect(result.unresolved).toBe(true);
    expect(result.resolved).toBe("$lib/Button.svelte");
    expect(result.searched).toBe("no tsconfig/jsconfig paths found");
  });

  test("reports an unresolved alias when no paths pattern matches the specifier", () => {
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

    const result = aliases.lookup("$missing/Button.svelte", TEST_DIR);
    expect(result.unresolved).toBe(true);
    expect(result.resolved).toBe("$missing/Button.svelte");
  });

  test("does not report a relative specifier as unresolved", () => {
    const result = aliases.lookup("./Button.svelte", TEST_DIR);
    expect(result.unresolved).toBe(false);
  });
});
