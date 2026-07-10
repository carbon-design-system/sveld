import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cli, parseCliOptions } from "../src/cli";
import { setQuiet } from "../src/logger";

describe("parseCliOptions", () => {
  test("--fail-fast enables failFast", () => {
    expect(parseCliOptions(["--fail-fast"])).toEqual({ kind: "options", options: { failFast: true } });
  });

  test("--quiet enables quiet", () => {
    expect(parseCliOptions(["--quiet"])).toEqual({ kind: "options", options: { quiet: true } });
  });

  test("--quiet=false disables quiet", () => {
    expect(parseCliOptions(["--quiet=false"])).toEqual({ kind: "options", options: { quiet: false } });
  });

  test("quiet is absent by default", () => {
    expect(parseCliOptions(["--glob", "--types"])).toEqual({
      kind: "options",
      options: { glob: true, types: true },
    });
  });

  test("--fail-fast=false disables failFast", () => {
    expect(parseCliOptions(["--fail-fast=false"])).toEqual({ kind: "options", options: { failFast: false } });
  });

  test("failFast is absent by default", () => {
    expect(parseCliOptions(["--glob", "--types"])).toEqual({
      kind: "options",
      options: { glob: true, types: true },
    });
  });

  test("--cache enables the default cache location", () => {
    expect(parseCliOptions(["--cache"])).toEqual({ kind: "options", options: { cache: true } });
  });

  test("--cache=<path> sets a custom cache location", () => {
    expect(parseCliOptions(["--cache=.cache/sveld.json"])).toEqual({
      kind: "options",
      options: { cache: ".cache/sveld.json" },
    });
  });

  test("--cache=false disables the cache", () => {
    expect(parseCliOptions(["--cache=false"])).toEqual({ kind: "options", options: { cache: false } });
  });

  test("--check enables the default snapshot check", () => {
    expect(parseCliOptions(["--check"])).toEqual({ kind: "options", options: { check: true } });
  });

  test("--check=<path> sets a custom snapshot location", () => {
    expect(parseCliOptions(["--check=api-snapshot.json"])).toEqual({
      kind: "options",
      options: { check: "api-snapshot.json" },
    });
  });

  test("--check=false disables the check", () => {
    expect(parseCliOptions(["--check=false"])).toEqual({ kind: "options", options: { check: false } });
  });

  test("--check-examples and --checkExamples produce identical options", () => {
    const canonical = parseCliOptions(["--check-examples"]);
    const alias = parseCliOptions(["--checkExamples"]);
    expect(canonical).toEqual({ kind: "options", options: { checkExamples: true } });
    expect(alias).toEqual(canonical);
  });

  test("--resolve-types and --resolveTypes produce identical options", () => {
    const canonical = parseCliOptions(["--resolve-types"]);
    const alias = parseCliOptions(["--resolveTypes"]);
    expect(canonical).toEqual({ kind: "options", options: { resolveTypes: true } });
    expect(alias).toEqual(canonical);
  });

  test("--report-diagnostics enables reportDiagnostics", () => {
    expect(parseCliOptions(["--report-diagnostics"])).toEqual({
      kind: "options",
      options: { reportDiagnostics: true },
    });
  });

  test("--report-diagnostics=false disables reportDiagnostics", () => {
    expect(parseCliOptions(["--report-diagnostics=false"])).toEqual({
      kind: "options",
      options: { reportDiagnostics: false },
    });
  });

  test("--strict enables strict", () => {
    expect(parseCliOptions(["--strict"])).toEqual({ kind: "options", options: { strict: true } });
  });

  test("--types-format=component sets typesOptions.format", () => {
    expect(parseCliOptions(["--types-format=component"])).toEqual({
      kind: "options",
      options: { typesOptions: { format: "component" } },
    });
  });

  test("unknown flag surfaces as an unknown result", () => {
    expect(parseCliOptions(["--markdwon"])).toEqual({ kind: "unknown", arg: "--markdwon" });
  });

  test("a positional argument surfaces as an unknown result", () => {
    expect(parseCliOptions(["foo"])).toEqual({ kind: "unknown", arg: "foo" });
  });

  test("--help short-circuits before later flags are parsed", () => {
    expect(parseCliOptions(["--help", "--markdwon"])).toEqual({ kind: "help" });
  });

  test("--version short-circuits before later flags are parsed", () => {
    expect(parseCliOptions(["--version", "--markdwon"])).toEqual({ kind: "version" });
  });
});

describe("cli() entry resolution failures", () => {
  // `process.exitCode = undefined` does not clear a previously-set numeric
  // exit code (Node/Bun ignore the assignment), so `0` is used as the
  // neutral baseline instead of relying on the initial `undefined` state.
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    process.argv = ["bun", "cli.js"];
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-entry-"));
    process.chdir(dir);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("sets exitCode 1 and writes nothing when no entry and no src/index.js fallback exist", async () => {
    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(existsSync(join(dir, "types"))).toBe(false);
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
  });

  test("falls back to src/index.js with a stderr note when resolution fails but the fallback exists", async () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "index.js"), "export {};\n");

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to "src/index.js"'));
  });
});

describe("cli() unknown flag", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-unknown-flag-"));
    process.chdir(dir);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("sets exitCode 1 and writes no output files for an unknown flag", async () => {
    process.argv = ["bun", "cli.js", "--markdwon"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("Unknown flag: --markdwon");
    expect(existsSync(join(dir, "types"))).toBe(false);
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
  });
});

describe("cli() --cache", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-cache-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "src", "Button.svelte"),
      '<script>\n  export let label = "";\n</script>\n<button>{label}</button>\n',
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "./Button.svelte";\n');
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
  });

  test("is on by default: a plain run creates the default cache file", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js"];

    await cli(process);

    expect(existsSync(join(dir, "src", "node_modules", ".cache", "sveld", "parse-cache.json"))).toBe(true);
  });

  test("--cache=false reaches generateBundle as false and creates no cache file", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--cache=false"];

    await cli(process);

    expect(existsSync(join(dir, "src", "node_modules", ".cache"))).toBe(false);
  });
});

describe("cli() --quiet", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-quiet-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "src", "Button.svelte"),
      '<script>\n  export let label = "";\n</script>\n<button>{label}</button>\n',
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "./Button.svelte";\n');
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    setQuiet(false);
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("a plain run prints writer progress lines to stderr", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--markdown", "--custom-elements"];

    await cli(process);

    expect(errorSpy).toHaveBeenCalledWith("created TypeScript definitions.");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('created "COMPONENT_API.json".'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('created "COMPONENT_INDEX.md".'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('created "custom-elements.json".'));
  });

  test("--quiet suppresses writer progress lines but still writes output files", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--markdown", "--custom-elements", "--quiet"];

    await cli(process);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "types", "Button.svelte.d.ts"))).toBe(true);
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(true);
    expect(existsSync(join(dir, "COMPONENT_INDEX.md"))).toBe(true);
    expect(existsSync(join(dir, "custom-elements.json"))).toBe(true);
  });

  test("quiet: true in the config file suppresses progress lines", async () => {
    writeFileSync(join(dir, "sveld.config.js"), "export default { quiet: true };\n");
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json"];

    await cli(process);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("--quiet does not suppress the fallback-entry warning", async () => {
    process.argv = ["bun", "cli.js", "--quiet"];

    await cli(process);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to "src/index.js"'));
  });
});

describe("cli() --types-format merges with config file typesOptions", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-types-format-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "src", "Button.svelte"),
      '<script>\n  export let label = "";\n</script>\n<button>{label}</button>\n',
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "./Button.svelte";\n');
    writeFileSync(join(dir, "sveld.config.js"), 'export default { typesOptions: { outDir: "custom-types" } };\n');
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
  });

  test("--types-format=component keeps the config file's typesOptions.outDir", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types-format=component"];

    await cli(process);

    const outputPath = join(dir, "custom-types", "Button.svelte.d.ts");
    expect(existsSync(outputPath)).toBe(true);
    expect(readFileSync(outputPath, "utf-8")).toContain("declare const Button: Component<");
  });
});
