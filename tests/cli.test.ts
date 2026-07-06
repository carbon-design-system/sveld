import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cli, parseCliOptions } from "../src/cli";

describe("parseCliOptions", () => {
  test("--fail-fast enables failFast", () => {
    expect(parseCliOptions(["--fail-fast"])).toEqual({ failFast: true });
  });

  test("--fail-fast=false disables failFast", () => {
    expect(parseCliOptions(["--fail-fast=false"])).toEqual({ failFast: false });
  });

  test("failFast is absent by default", () => {
    expect(parseCliOptions(["--glob", "--types"])).toEqual({ glob: true, types: true });
  });

  test("--cache enables the default cache location", () => {
    expect(parseCliOptions(["--cache"])).toEqual({ cache: true });
  });

  test("--cache=<path> sets a custom cache location", () => {
    expect(parseCliOptions(["--cache=.cache/sveld.json"])).toEqual({ cache: ".cache/sveld.json" });
  });

  test("--cache=false disables the cache", () => {
    expect(parseCliOptions(["--cache=false"])).toEqual({ cache: false });
  });

  test("--check enables the default snapshot check", () => {
    expect(parseCliOptions(["--check"])).toEqual({ check: true });
  });

  test("--check=<path> sets a custom snapshot location", () => {
    expect(parseCliOptions(["--check=api-snapshot.json"])).toEqual({ check: "api-snapshot.json" });
  });

  test("--check=false disables the check", () => {
    expect(parseCliOptions(["--check=false"])).toEqual({ check: false });
  });

  test("--checkExamples enables checkExamples", () => {
    expect(parseCliOptions(["--checkExamples"])).toEqual({ checkExamples: true });
  });

  test("--report-diagnostics enables reportDiagnostics", () => {
    expect(parseCliOptions(["--report-diagnostics"])).toEqual({ reportDiagnostics: true });
  });

  test("--report-diagnostics=false disables reportDiagnostics", () => {
    expect(parseCliOptions(["--report-diagnostics=false"])).toEqual({ reportDiagnostics: false });
  });

  test("--strict enables strict", () => {
    expect(parseCliOptions(["--strict"])).toEqual({ strict: true });
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
