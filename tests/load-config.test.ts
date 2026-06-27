import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig, loadConfigFrom, mergeConfig, resolveConfigPath } from "../src/load-config";
import type { PluginSveldOptions } from "../src/plugin";

function withTempDir(prefix: string, run: (dir: string) => void | Promise<void>) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("resolveConfigPath", () => {
  test("returns null when no config file exists", () => {
    withTempDir("sveld-config-resolve-", (dir) => {
      expect(resolveConfigPath(dir)).toBeNull();
    });
  });

  test("discovers a config file at the root", () => {
    withTempDir("sveld-config-resolve-", (dir) => {
      const configPath = path.join(dir, "sveld.config.js");
      writeFileSync(configPath, "export default {};");
      expect(resolveConfigPath(dir)).toBe(configPath);
    });
  });

  test("prefers sveld.config.js over sveld.config.ts", () => {
    withTempDir("sveld-config-resolve-", (dir) => {
      writeFileSync(path.join(dir, "sveld.config.ts"), "export default {};");
      writeFileSync(path.join(dir, "sveld.config.js"), "export default {};");
      expect(resolveConfigPath(dir)).toBe(path.join(dir, "sveld.config.js"));
    });
  });
});

describe("loadConfig", () => {
  test("returns an empty object when no config file is present", async () => {
    await withTempDir("sveld-config-load-", async (dir) => {
      await expect(loadConfig(dir)).resolves.toEqual({});
    });
  });

  test("loads the default-exported options object", async () => {
    await withTempDir("sveld-config-load-", async (dir) => {
      writeFileSync(path.join(dir, "sveld.config.js"), "export default { glob: true, json: true, types: false };");
      await expect(loadConfig(dir)).resolves.toEqual({ glob: true, json: true, types: false });
    });
  });

  test("supports the defineConfig helper", async () => {
    await withTempDir("sveld-config-load-", async (dir) => {
      const helperPath = path.join(import.meta.dir, "..", "src", "load-config.ts");
      writeFileSync(
        path.join(dir, "sveld.config.ts"),
        `import { defineConfig } from ${JSON.stringify(helperPath)};\n` +
          "export default defineConfig({ markdown: true });",
      );
      await expect(loadConfig(dir)).resolves.toEqual({ markdown: true });
    });
  });

  test("throws when the config throws at evaluation time", async () => {
    await withTempDir("sveld-config-load-", async (dir) => {
      const configPath = path.join(dir, "sveld.config.js");
      writeFileSync(configPath, "throw new Error('boom');");
      await expect(loadConfigFrom(configPath)).rejects.toThrow(`sveld: failed to load config file "${configPath}".`);
      await expect(loadConfigFrom(configPath)).rejects.toThrow("boom");
    });
  });

  test("throws when the default export is not an object", async () => {
    await withTempDir("sveld-config-load-", async (dir) => {
      const configPath = path.join(dir, "sveld.config.js");
      writeFileSync(configPath, "export default 42;");
      await expect(loadConfigFrom(configPath)).rejects.toThrow(
        "must export a configuration object as its default export",
      );
    });
  });

  test("throws when the default export is an array", async () => {
    await withTempDir("sveld-config-load-", async (dir) => {
      const configPath = path.join(dir, "sveld.config.js");
      writeFileSync(configPath, "export default [];");
      await expect(loadConfigFrom(configPath)).rejects.toThrow(
        "must export a configuration object as its default export",
      );
    });
  });

  test("throws when there is no default export", async () => {
    await withTempDir("sveld-config-load-", async (dir) => {
      const configPath = path.join(dir, "sveld.config.js");
      writeFileSync(configPath, "export const glob = true;");
      await expect(loadConfigFrom(configPath)).rejects.toThrow(
        "must export a configuration object as its default export",
      );
    });
  });
});

describe("mergeConfig", () => {
  test("later sources override earlier ones", () => {
    const fileConfig: Partial<PluginSveldOptions> = { glob: true, types: false, json: true };
    expect(mergeConfig(fileConfig, { types: true })).toEqual({
      glob: true,
      types: true,
      json: true,
    });
  });

  test("ignores undefined sources", () => {
    expect(mergeConfig(undefined, { json: true }, undefined)).toEqual({ json: true });
  });

  test("returns an empty object with no sources", () => {
    expect(mergeConfig()).toEqual({});
  });

  test("leaves config keys alone when a later source omits them", () => {
    expect(mergeConfig({ markdown: true }, {})).toEqual({ markdown: true });
  });
});
