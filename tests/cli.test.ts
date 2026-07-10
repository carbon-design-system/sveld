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

  test("--stdout enables stdout", () => {
    expect(parseCliOptions(["--stdout"])).toEqual({ kind: "options", options: { stdout: true } });
  });

  test("--stdout=false disables stdout", () => {
    expect(parseCliOptions(["--stdout=false"])).toEqual({ kind: "options", options: { stdout: false } });
  });

  test("--stdout=json sets stdout to json", () => {
    expect(parseCliOptions(["--stdout=json"])).toEqual({ kind: "options", options: { stdout: "json" } });
  });

  test("--stdout=ndjson sets stdout to ndjson", () => {
    expect(parseCliOptions(["--stdout=ndjson"])).toEqual({ kind: "options", options: { stdout: "ndjson" } });
  });

  test("--types-format=component sets typesOptions.format", () => {
    expect(parseCliOptions(["--types-format=component"])).toEqual({
      kind: "options",
      options: { typesOptions: { format: "component" } },
    });
  });

  test("--format=json sets format to json", () => {
    expect(parseCliOptions(["--format=json"])).toEqual({ kind: "options", options: { format: "json" } });
  });

  test("--format=text sets format to text", () => {
    expect(parseCliOptions(["--format=text"])).toEqual({ kind: "options", options: { format: "text" } });
  });

  test("a bare --format is ignored", () => {
    expect(parseCliOptions(["--format"])).toEqual({ kind: "options", options: {} });
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

describe("cli() --stdout", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let errorSpy: ReturnType<typeof jest.spyOn>;
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-stdout-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "src", "Button.svelte"),
      '<script>\n  export let label = "";\n</script>\n<button>{label}</button>\n',
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "./Button.svelte";\n');
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("--json --stdout prints the combined JSON document to stdout and writes nothing to disk", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--stdout"];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const printed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(printed).toMatchObject({ schemaVersion: 1, total: 1 });
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
    expect(existsSync(join(dir, "types"))).toBe(false);
  });

  test("--markdown --stdout prints the Markdown document to stdout and writes nothing to disk", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--markdown", "--stdout"];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy.mock.calls[0][0]).toContain("Button");
    expect(existsSync(join(dir, "COMPONENT_INDEX.md"))).toBe(false);
    expect(existsSync(join(dir, "types"))).toBe(false);
  });

  test("--custom-elements --stdout prints the manifest to stdout and writes nothing to disk", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--custom-elements", "--stdout"];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const printed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(printed.schemaVersion).toBe("1.0.0");
    expect(existsSync(join(dir, "custom-elements.json"))).toBe(false);
    expect(existsSync(join(dir, "types"))).toBe(false);
  });

  test("--stdout with no document-producing output errors and generates nothing", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--stdout"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--stdout requires exactly one of"));
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "types"))).toBe(false);
  });

  test("--json --markdown --stdout errors and generates nothing", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--markdown", "--stdout"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--stdout requires exactly one of"));
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
    expect(existsSync(join(dir, "COMPONENT_INDEX.md"))).toBe(false);
  });

  test("--json --types --stdout errors and generates nothing", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--types", "--stdout"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--stdout cannot be combined with --types"));
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "types"))).toBe(false);
  });

  test("--json --check --stdout errors and generates nothing", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--check", "--stdout"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--stdout cannot be combined with --check"));
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
  });

  test("--stdout=yaml errors and generates nothing", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--stdout=yaml"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--stdout must be "json" or "ndjson"'));
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  test("--markdown --stdout=ndjson errors and generates nothing", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--markdown", "--stdout=ndjson"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--stdout=ndjson is only valid with --json"));
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});

describe("cli() --stdout=ndjson", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-stdout-ndjson-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "src", "Button.svelte"),
      '<script>\n  export let label = "";\n</script>\n<button>{label}</button>\n',
    );
    writeFileSync(
      join(dir, "src", "Alert.svelte"),
      '<script>\n  export let message = "";\n</script>\n<div>{message}</div>\n',
    );
    writeFileSync(
      join(dir, "src", "index.js"),
      'export { default as Button } from "./Button.svelte";\nexport { default as Alert } from "./Alert.svelte";\n',
    );
    jest.spyOn(console, "error").mockImplementation(() => {});
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("--json --stdout=ndjson prints one JSON object per component per line, in document order", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--stdout=ndjson"];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);

    const printed = stdoutSpy.mock.calls[0][0] as string;
    const lines = printed.trimEnd().split("\n");
    expect(lines).toHaveLength(2);

    const documentArgv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--stdout"];
    process.argv = documentArgv;
    stdoutSpy.mockClear();
    await cli(process);
    const document = JSON.parse(stdoutSpy.mock.calls[0][0] as string);

    expect(lines.map((line) => JSON.parse(line))).toEqual(document.components);
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
  });

  test("--json --stdout=json keeps the single-document behavior", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--stdout=json"];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const printed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(printed).toMatchObject({ schemaVersion: 1, total: 2 });
  });
});

describe("cli() --format usage error", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-format-error-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "Button.svelte"), "<script></script>\n<button>Click</button>\n");
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "./Button.svelte";\n');
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("--format=yaml errors and generates nothing", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--format=yaml"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--format must be "text" or "json"; got "yaml"'));
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
    expect(existsSync(join(dir, "types"))).toBe(false);
  });
});

describe("cli() --format with --check", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let logSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(async () => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-format-check-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "./Button.svelte";\n');
    jest.spyOn(console, "error").mockImplementation(() => {});
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Snapshot a prop-less Button, then add a required prop so `--check` has a breaking change to report.
    writeFileSync(join(dir, "src", "Button.svelte"), "<script></script>\n<button>Click</button>\n");
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json"];
    await cli(process);
    stdoutSpy.mockClear();
    logSpy.mockClear();

    writeFileSync(
      join(dir, "src", "Button.svelte"),
      '<script>\n  export let label;\n</script>\n<button>{label}</button>\n',
    );
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("--format=json prints the CheckResult as JSON to stdout", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check", "--format=json"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const printed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(printed.kind).toBe("check-report");
    expect(printed.bump).toBe("major");
    expect(printed.changes).toContainEqual(
      expect.objectContaining({ component: "Button", kind: "prop", name: "label", bump: "major" }),
    );
  });

  test("--format=text keeps the text report on stdout (default behavior unchanged)", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check", "--format=text"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[BREAKING] prop "label" added (required)'));
  });

  test("omitting --format keeps the text report on stdout", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Suggested semver bump: major."));
  });
});

describe("cli() --format with --report-diagnostics", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let stderrSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-format-diagnostics-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "src", "Phantom.svelte"),
      "<script>\n  /** @event {CustomEvent<null>} phantom */\n  export let label;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Phantom } from "./Phantom.svelte";\n');
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("--format=json prints the diagnostics as JSON to stderr", async () => {
    process.argv = [
      "bun",
      "cli.js",
      "--entry=src/index.js",
      "--types=false",
      "--report-diagnostics",
      "--format=json",
    ];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const printed = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(printed.kind).toBe("diagnostics");
    expect(printed.diagnostics).toContainEqual(
      expect.objectContaining({ kind: "event-no-source", name: "phantom" }),
    );
  });

  test("--format=text keeps the text summary on stderr (default behavior unchanged)", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--report-diagnostics", "--format=text"];

    await cli(process);

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("unresolved type"));
  });

  test("--format=json with no diagnostics prints nothing, same as text", async () => {
    writeFileSync(join(dir, "src", "Phantom.svelte"), "<script></script>\n<button>Click</button>\n");
    process.argv = [
      "bun",
      "cli.js",
      "--entry=src/index.js",
      "--types=false",
      "--report-diagnostics",
      "--format=json",
    ];

    await cli(process);

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
