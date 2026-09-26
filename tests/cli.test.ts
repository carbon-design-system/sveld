import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cli, parseCliOptions } from "../src/cli";
import { setQuiet } from "../src/logger";

const DIAGNOSTICS_SUMMARY_REGEX = /^sveld: \d+ diagnostics? \(/;

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

  test("--check-level=<value> sets the gate level", () => {
    expect(parseCliOptions(["--check-level=minor"])).toEqual({ kind: "options", options: { checkLevel: "minor" } });
  });

  test("--check-examples enables checkExamples", () => {
    expect(parseCliOptions(["--check-examples"])).toEqual({ kind: "options", options: { checkExamples: true } });
  });

  test("a camelCase flag is rejected with the kebab-case spelling as the suggestion", () => {
    expect(parseCliOptions(["--checkExamples"])).toEqual({
      kind: "unknown",
      arg: "--checkExamples",
      suggestion: "check-examples",
    });
    expect(parseCliOptions(["--reportDiagnostics"])).toEqual({
      kind: "unknown",
      arg: "--reportDiagnostics",
      suggestion: "report-diagnostics",
    });
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

  test("--strict=errors sets strict to errors", () => {
    expect(parseCliOptions(["--strict=errors"])).toEqual({ kind: "options", options: { strict: "errors" } });
  });

  test("--strict=false disables strict", () => {
    expect(parseCliOptions(["--strict=false"])).toEqual({ kind: "options", options: { strict: false } });
  });

  test("--check-examples=syntax runs only the markup path", () => {
    expect(parseCliOptions(["--check-examples=syntax"])).toEqual({
      kind: "options",
      options: { checkExamples: "syntax" },
    });
  });

  test("--stdout enables stdout", () => {
    expect(parseCliOptions(["--stdout"])).toEqual({ kind: "options", options: { stdout: true } });
  });

  test("--stdout=false disables stdout", () => {
    expect(parseCliOptions(["--stdout=false"])).toEqual({ kind: "options", options: { stdout: false } });
  });

  test("--stdout=<value> is a usage error", () => {
    expect(parseCliOptions(["--stdout=yaml"])).toEqual({
      kind: "usage-error",
      message: 'sveld: --stdout does not take a value; got "yaml".',
    });
  });

  test("--types-format=component sets typesOptions.format", () => {
    expect(parseCliOptions(["--types-format=component"])).toEqual({
      kind: "options",
      options: { typesOptions: { format: "component" } },
    });
  });

  test("--types-index-types enables typesOptions.indexTypes", () => {
    expect(parseCliOptions(["--types-index-types"])).toEqual({
      kind: "options",
      options: { typesOptions: { indexTypes: true } },
    });
  });

  test("--types-index-types=false disables typesOptions.indexTypes", () => {
    expect(parseCliOptions(["--types-index-types=false"])).toEqual({
      kind: "options",
      options: { typesOptions: { indexTypes: false } },
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

  test("unknown flag surfaces as an unknown result with a typo suggestion", () => {
    expect(parseCliOptions(["--markdwon"])).toEqual({ kind: "unknown", arg: "--markdwon", suggestion: "markdown" });
  });

  test("a close typo of a camelCase flag suggests the kebab-case spelling", () => {
    expect(parseCliOptions(["--checkExampls"])).toEqual({
      kind: "unknown",
      arg: "--checkExampls",
      suggestion: "check-examples",
    });
  });

  test("a distant unknown flag surfaces with no suggestion", () => {
    expect(parseCliOptions(["--xyz123garbage"])).toEqual({ kind: "unknown", arg: "--xyz123garbage" });
  });

  test("--failfast suggests --fail-fast", () => {
    expect(parseCliOptions(["--failfast"])).toEqual({ kind: "unknown", arg: "--failfast", suggestion: "fail-fast" });
  });

  test("a positional argument surfaces as an unknown result", () => {
    expect(parseCliOptions(["foo"])).toEqual({ kind: "unknown", arg: "foo" });
  });

  test("a positional argument after a boolean flag hints at the space-separated form", () => {
    expect(parseCliOptions(["--json", "true"])).toEqual({
      kind: "unknown",
      arg: "true",
      positionalHint: true,
    });
  });

  test("a positional argument after --fail-fast hints at the space-separated form", () => {
    expect(parseCliOptions(["--fail-fast", "foo"])).toEqual({
      kind: "unknown",
      arg: "foo",
      positionalHint: true,
    });
  });

  test("--entry accepts its value as the next argument", () => {
    expect(parseCliOptions(["--entry", "src/index.js"])).toEqual({
      kind: "options",
      options: { entry: "src/index.js" },
    });
  });

  test("--cache accepts its value as the next argument", () => {
    expect(parseCliOptions(["--cache", ".cache/sveld.json"])).toEqual({
      kind: "options",
      options: { cache: ".cache/sveld.json" },
    });
  });

  test("--check accepts its value as the next argument", () => {
    expect(parseCliOptions(["--check", "api-snapshot.json"])).toEqual({
      kind: "options",
      options: { check: "api-snapshot.json" },
    });
  });

  test("--types-format accepts its value as the next argument", () => {
    expect(parseCliOptions(["--types-format", "component"])).toEqual({
      kind: "options",
      options: { typesOptions: { format: "component" } },
    });
  });

  test("space-separated and = forms combine across multiple flags", () => {
    expect(parseCliOptions(["--entry", "src/index.js", "--json", "--cache=.cache/sveld.json"])).toEqual({
      kind: "options",
      options: { entry: "src/index.js", json: true, cache: ".cache/sveld.json" },
    });
  });

  test("multiple flags that each set a typesOptions key merge into one object instead of clobbering each other", () => {
    expect(parseCliOptions(["--types-format=component", "--types-index-types"])).toEqual({
      kind: "options",
      options: {
        typesOptions: { format: "component", indexTypes: true },
      },
    });
  });

  test("--entry followed by another flag falls back to a usage error naming the flag", () => {
    expect(parseCliOptions(["--entry", "--json"])).toEqual({
      kind: "usage-error",
      message: "sveld: --entry requires a value (pass --entry=<value> or --entry <value>).",
    });
  });

  test("--types-format followed by another flag falls back to a usage error naming the flag", () => {
    expect(parseCliOptions(["--types-format", "--json"])).toEqual({
      kind: "usage-error",
      message: "sveld: --types-format requires a value (pass --types-format=<value> or --types-format <value>).",
    });
  });

  test("--cache followed by another flag falls back to the default cache location", () => {
    expect(parseCliOptions(["--cache", "--json"])).toEqual({
      kind: "options",
      options: { cache: true, json: true },
    });
  });

  test("--check followed by another flag falls back to the default snapshot path", () => {
    expect(parseCliOptions(["--check", "--json"])).toEqual({
      kind: "options",
      options: { check: true, json: true },
    });
  });

  test("boolean flags never consume a following argument as a value", () => {
    expect(parseCliOptions(["--json", "COMPONENT.md"])).toEqual({
      kind: "unknown",
      arg: "COMPONENT.md",
      positionalHint: true,
    });
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
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('using "src/index.js"'));
  });

  test("a mistyped --entry exits 1 instead of falling back to src/index.js", async () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "index.js"), "export {};\n");
    process.argv = ["bun", "cli.js", "--entry=src/indx.js"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid entry point"));
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('using "src/index.js"'));
  });

  test("a package.json#svelte path that doesn't exist exits 1 and names the field", async () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "index.js"), "export {};\n");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ svelte: "./src/missing.js" }));

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('The "svelte" field in package.json points to "./src/missing.js"'),
    );
  });
});

describe("cli() config file errors", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    process.argv = ["bun", "cli.js"];
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-config-error-"));
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("a config file with a syntax error exits 1 with its message, not a stack trace", async () => {
    writeFileSync(join(dir, "sveld.config.js"), "export default { json: true,, };\n");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await cli(process);

    expect(process.exitCode).toBe(1);
    // Other test files log concurrently under --parallel, so find this call by content.
    const printed = errorSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .find((message: string) => message.startsWith("sveld: failed to load config file"));
    expect(printed).toBeDefined();
    expect(printed).not.toContain("    at ");
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
    expect(errorSpy).toHaveBeenCalledWith('sveld: unknown flag "--markdwon". Did you mean "--markdown"?');
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

  test("--entry accepts its value as a space-separated argument", async () => {
    process.argv = ["bun", "cli.js", "--entry", "src/index.js"];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(existsSync(join(dir, "types", "Button.svelte.d.ts"))).toBe(true);
  });
});

describe("cli() --entry followed by another flag", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-entry-flag-"));
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

  test("sets exitCode 1 and reports a usage error naming --entry", async () => {
    process.argv = ["bun", "cli.js", "--entry", "--json"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("sveld: --entry requires a value (pass --entry=<value> or --entry <value>).");
    expect(existsSync(join(dir, "types"))).toBe(false);
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
  });
});

describe("cli() generation errors", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-generation-errors-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "src", "Button.svelte"),
      '<script>\n  export let label = "";\n</script>\n<button>{label}</button>\n',
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "./Button.svelte";\n');
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("without --fail-fast, a parse error still exits 2 after writing the other components", async () => {
    writeFileSync(
      join(dir, "src", "Broken.svelte"),
      "<script>\n  export let label = ;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(
      join(dir, "src", "index.js"),
      'export { default as Button } from "./Button.svelte";\nexport { default as Broken } from "./Broken.svelte";\n',
    );
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json"];

    await cli(process);

    expect(process.exitCode).toBe(2);
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(true);
  });

  test("an unresolved re-export alias prints one clear line and exits 1, not a raw stack trace", async () => {
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "$components/Button.svelte";\n');
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('cannot resolve "$components/Button.svelte"'));
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
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
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--markdown"];

    await cli(process);

    expect(errorSpy).toHaveBeenCalledWith('created 2 of 2 TypeScript definitions in "types".');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('created "COMPONENT_API.json".'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('created "COMPONENT_INDEX.md".'));
  });

  test("--quiet suppresses writer progress lines but still writes output files", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--json", "--markdown", "--quiet"];

    await cli(process);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "types", "Button.svelte.d.ts"))).toBe(true);
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(true);
    expect(existsSync(join(dir, "COMPONENT_INDEX.md"))).toBe(true);
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

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('using "src/index.js"'));
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

describe("cli() --types-* usage errors", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-types-error-"));
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

  test("--types-format=oops errors and generates nothing", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types-format=oops"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--types-format must be "class" or "component"; got "oops"'),
    );
    expect(existsSync(join(dir, "types"))).toBe(false);
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
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--stdout does not take a value"));
    expect(stdoutSpy).not.toHaveBeenCalled();
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
      "<script>\n  export let label;\n</script>\n<button>{label}</button>\n",
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

    expect(process.exitCode).toBe(3);
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

    expect(process.exitCode).toBe(3);
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[BREAKING] prop "label" added (required)'));
  });

  test("omitting --format keeps the text report on stdout", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check"];

    await cli(process);

    expect(process.exitCode).toBe(3);
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Suggested semver bump: major."));
  });
});

describe("cli() --check with no snapshot", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let logSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-check-missing-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "./Button.svelte";\n');
    writeFileSync(join(dir, "src", "Button.svelte"), "<script></script>\n<button>Click</button>\n");
    jest.spyOn(console, "error").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("exits 1 when the snapshot is missing, so a mistyped path can't pass CI", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check=snapshots/api.json"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Generate it with `sveld --json` with `jsonOptions.outFile: "snapshots/api.json"`'),
    );
  });

  test("exits 0 when this run writes the snapshot (`--json --check`)", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json", "--check"];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("no snapshot found"));
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(true);
  });
});

describe("cli() --check-level", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let logSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(async () => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-check-level-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Button } from "./Button.svelte";\n');
    jest.spyOn(console, "error").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Snapshot a prop-less Button, then add a new optional prop so `--check`
    // has a minor (additive) change to report, not a breaking one.
    writeFileSync(join(dir, "src", "Button.svelte"), "<script></script>\n<button>Click</button>\n");
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json"];
    await cli(process);
    logSpy.mockClear();

    writeFileSync(
      join(dir, "src", "Button.svelte"),
      '<script>\n  export let icon = "";\n</script>\n<button>{icon}</button>\n',
    );
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("defaults to major: a minor change does not fail the run", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check"];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Suggested semver bump: minor."));
  });

  test("--check-level=minor fails the run on a minor change", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check", "--check-level=minor"];

    await cli(process);

    expect(process.exitCode).toBe(3);
  });

  test("--check-level=patch fails the run on a minor change", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check", "--check-level=patch"];

    await cli(process);

    expect(process.exitCode).toBe(3);
  });

  test("rejects an invalid --check-level value", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check", "--check-level=oops"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--check-level must be "major", "minor", or "patch"'),
    );
  });

  test("a schema mismatch exits 1 (usage error) regardless of --check-level", async () => {
    const snapshotPath = join(dir, "COMPONENT_API.json");
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8"));
    writeFileSync(snapshotPath, JSON.stringify({ ...snapshot, schemaVersion: 99 }));

    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check", "--check-level=patch"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[schema] snapshot schemaVersion 99 differs from"));
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
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--report-diagnostics", "--format=json"];

    await cli(process);

    expect(process.exitCode).toBe(0);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const printed = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(printed.kind).toBe("diagnostics");
    expect(printed.diagnostics).toContainEqual(expect.objectContaining({ kind: "event-no-source", name: "phantom" }));
  });

  test("--format=text keeps the text summary on stderr (default behavior unchanged)", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--report-diagnostics", "--format=text"];

    await cli(process);

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(DIAGNOSTICS_SUMMARY_REGEX));
  });

  test("--format=json with no diagnostics prints nothing, same as text", async () => {
    writeFileSync(join(dir, "src", "Phantom.svelte"), "<script></script>\n<button>Click</button>\n");
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--report-diagnostics", "--format=json"];

    await cli(process);

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("cli() exit codes", () => {
  let dir: string;
  let previousCwd: string;
  let previousArgv: string[];
  let errorSpy: ReturnType<typeof jest.spyOn>;
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let logSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
    process.exitCode = 0;
    dir = mkdtempSync(join(tmpdir(), "sveld-cli-exit-codes-"));
    process.chdir(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    process.exitCode = 0;
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("sets exitCode 2 and prints the error to stderr when --fail-fast rethrows a parse failure", async () => {
    writeFileSync(
      join(dir, "src", "Broken.svelte"),
      "<script>\n  export let label = ;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Broken } from "./Broken.svelte";\n');
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json", "--fail-fast"];

    await cli(process);

    expect(process.exitCode).toBe(2);
    expect(errorSpy).toHaveBeenCalled();
    expect(existsSync(join(dir, "COMPONENT_API.json"))).toBe(false);
  });

  test("sets exitCode 4 when diagnostics exist under --strict without --check", async () => {
    writeFileSync(
      join(dir, "src", "Phantom.svelte"),
      "<script>\n  /** @event {CustomEvent<null>} phantom */\n  export let label;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Phantom } from "./Phantom.svelte";\n');
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json", "--strict"];

    await cli(process);

    expect(process.exitCode).toBe(4);
  });

  test("--strict=errors keeps exitCode 0 when only warning-severity diagnostics exist", async () => {
    writeFileSync(
      join(dir, "src", "Phantom.svelte"),
      "<script>\n  /** @event {CustomEvent<null>} phantom */\n  export let label;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Phantom } from "./Phantom.svelte";\n');
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json", "--strict=errors"];

    await cli(process);

    expect(process.exitCode).toBe(0);
  });

  test("--strict=errors sets exitCode 4 when an error-severity diagnostic exists", async () => {
    writeFileSync(
      join(dir, "src", "Broken.svelte"),
      '<script>\n  /**\n   * @internal\n   * @typedef {{ id: string }} Secret\n   */\n  /** @type {Secret} */\n  export let value = { id: "a" };\n</script>\n',
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Broken } from "./Broken.svelte";\n');
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json", "--strict=errors"];

    await cli(process);

    expect(process.exitCode).toBe(4);
  });

  test("--strict=oops is a usage error", async () => {
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--strict=oops"];

    await cli(process);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--strict must be "errors"'));
  });

  test("exits 3 (not 4) when a --check breaking change and --strict diagnostics both apply in one run", async () => {
    writeFileSync(join(dir, "src", "Button.svelte"), "<script></script>\n<button>Click</button>\n");
    writeFileSync(
      join(dir, "src", "Phantom.svelte"),
      "<script>\n  /** @event {CustomEvent<null>} phantom */\n  export let label;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(
      join(dir, "src", "index.js"),
      'export { default as Button } from "./Button.svelte";\nexport { default as Phantom } from "./Phantom.svelte";\n',
    );
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json"];
    await cli(process);
    stdoutSpy.mockClear();
    logSpy.mockClear();
    errorSpy.mockClear();

    // Add a required prop to Button so `--check` has a breaking change to report,
    // alongside Phantom's pre-existing diagnostic.
    writeFileSync(
      join(dir, "src", "Button.svelte"),
      "<script>\n  export let label;\n</script>\n<button>{label}</button>\n",
    );
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--check", "--strict"];

    await cli(process);

    expect(process.exitCode).toBe(3);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Suggested semver bump: major."));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(DIAGNOSTICS_SUMMARY_REGEX));
  });

  test("sets exitCode 2 and names the requirement when --check-examples finds an incompatible typescript", async () => {
    // Shadows the real `typescript` package for this project with a fake,
    // pre-7 install so `TypeResolver.create`'s version check fails without
    // touching the real dependency the rest of the suite relies on.
    mkdirSync(join(dir, "node_modules", "typescript"), { recursive: true });
    writeFileSync(
      join(dir, "node_modules", "typescript", "package.json"),
      JSON.stringify({ name: "typescript", version: "5.9.0" }),
    );
    writeFileSync(
      join(dir, "src", "Documented.svelte"),
      [
        "<script>",
        "  /**",
        "   * @example",
        "   * ```js",
        '   * formatValue("ok");',
        "   * ```",
        "   */",
        "  export function formatValue(value) {",
        "    return value;",
        "  }",
        "</script>",
      ].join("\n"),
    );
    writeFileSync(join(dir, "src", "index.js"), 'export { default as Documented } from "./Documented.svelte";\n');
    process.argv = ["bun", "cli.js", "--entry=src/index.js", "--types=false", "--json", "--check-examples"];

    await cli(process);

    expect(process.exitCode).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("TypeScript 7"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("5.9.0"));
  });
});

describe("cli() --help", () => {
  let previousArgv: string[];
  let logSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousArgv = process.argv;
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = previousArgv;
    jest.restoreAllMocks();
  });

  test("documents the real exit codes for --strict and --check, not the stale code 1", async () => {
    process.argv = ["bun", "cli.js", "--help"];

    await cli(process);

    const help = logSpy.mock.calls.map((call: unknown[]) => call[0]).join("\n");
    expect(help).toContain("Exit with code 4");
    expect(help).toContain("exit 3 on a breaking change");
    expect(help).not.toContain("Exit with code 1 when diagnostics exist");
    expect(help).not.toContain("exit 1 on a breaking change");
  });
});
