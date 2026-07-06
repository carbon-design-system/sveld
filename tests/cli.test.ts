import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cli, parseCliOptions } from "../src/cli";

describe("parseCliOptions", () => {
  test("--fail-fast enables failFast", () => {
    expect(parseCliOptions(["--fail-fast"])).toEqual({ kind: "options", options: { failFast: true } });
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
