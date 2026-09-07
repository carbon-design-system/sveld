import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import ComponentParser from "../src/ComponentParser";
import {
  applyDiagnosticIgnores,
  createDiagnostic,
  dedupeDiagnostics,
  failingDiagnostics,
  formatDiagnosticsSummary,
  formatDiagnosticsSummaryJson,
  type SveldDiagnostic,
  type SveldDiagnosticInput,
} from "../src/diagnostics";
import { sveld } from "../src/sveld";

const parseContext = { moduleName: "TestComponent", filePath: "./TestComponent.svelte" };

describe("ComponentParser diagnostics", () => {
  test("emits no diagnostics when every type is resolved", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        export let label: string;
      </script>
      <button>{label}</button>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);

    expect(diagnostics).toEqual([]);
  });

  test("flags props whose type falls back to unknown", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        export let value;
      </script>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);
    const propDiagnostic = diagnostics?.find((d) => d.kind === "prop-unknown-type");

    expect(propDiagnostic).toMatchObject({
      component: "./TestComponent.svelte",
      kind: "prop-unknown-type",
      code: "sveld/prop-unknown-type",
      severity: "warning",
      name: "value",
    });
    expect(typeof propDiagnostic?.message).toBe("string");
    expect(propDiagnostic?.source?.start.line).toBe(3);
  });

  test("flags setContext values that default to any", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        import { setContext } from "svelte";
        let store;
        setContext("ctx", { store });
        setContext("plain", store);
      </script>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);
    const contextDiagnostics = diagnostics?.filter((d) => d.kind === "context-any-type") ?? [];

    expect(contextDiagnostics).toHaveLength(2);
    expect(contextDiagnostics[0]).toMatchObject({ kind: "context-any-type", name: "store" });
  });

  test("flags @event tags with no matching dispatch or callback prop", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @event {CustomEvent<null>} phantom */
        export let label;
      </script>
      <button>{label}</button>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);
    const eventDiagnostic = diagnostics?.find((d) => d.kind === "event-no-source");

    expect(eventDiagnostic).toMatchObject({
      kind: "event-no-source",
      name: "phantom",
    });
  });

  test("does not flag @event tags backed by a dispatch call", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        import { createEventDispatcher } from "svelte";
        const dispatch = createEventDispatcher();
        /** @event {CustomEvent<null>} change */
        function update() {
          dispatch("change");
        }
      </script>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);

    expect(diagnostics?.some((d) => d.kind === "event-no-source")).toBe(false);
  });

  test("flags a non-trivial {@render} argument as syntax-skipped", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        let { children, title } = $props();
      </script>
      <div>{title}{@render children(getProps())}</div>
    `;

    const { diagnostics, props } = parser.parseSvelteComponent(source, parseContext);
    const syntaxDiagnostic = diagnostics?.find((d) => d.kind === "syntax-skipped");

    expect(syntaxDiagnostic).toMatchObject({ kind: "syntax-skipped", name: "children" });
    expect(typeof syntaxDiagnostic?.message).toBe("string");
    expect(syntaxDiagnostic?.source).toBeDefined();
    expect(props.map((p) => p.name)).toContain("title");
  });

  test("@sveld-ignore on a prop's JSDoc suppresses its prop-unknown-type diagnostic", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * @sveld-ignore sveld/prop-unknown-type
         */
        export let value;
      </script>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);
    const propDiagnostic = diagnostics?.find((d) => d.kind === "prop-unknown-type");

    expect(propDiagnostic).toMatchObject({ kind: "prop-unknown-type", name: "value", ignored: true });
  });

  test("@sveld-ignore with a different code does not suppress the diagnostic", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * @sveld-ignore sveld/context-any-type
         */
        export let value;
      </script>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);
    const propDiagnostic = diagnostics?.find((d) => d.kind === "prop-unknown-type");

    expect(propDiagnostic?.ignored).toBeFalsy();
  });

  test("a bare @sveld-ignore (no code) suppresses any diagnostic for that symbol", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @sveld-ignore */
        export let value;
      </script>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);
    const propDiagnostic = diagnostics?.find((d) => d.kind === "prop-unknown-type");

    expect(propDiagnostic?.ignored).toBe(true);
  });

  test("@sveld-ignore next to an @event tag suppresses its event-no-source diagnostic", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * @event {CustomEvent<null>} phantom
         * @sveld-ignore sveld/event-no-source
         */
        export let label;
      </script>
      <button>{label}</button>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);
    const eventDiagnostic = diagnostics?.find((d) => d.kind === "event-no-source");

    expect(eventDiagnostic).toMatchObject({ kind: "event-no-source", name: "phantom", ignored: true });
  });

  test("@sveld-ignore on a context variable's JSDoc suppresses its context-any-type diagnostic", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        import { setContext } from "svelte";
        /**
         * @sveld-ignore sveld/context-any-type
         */
        let store;
        setContext("plain", store);
      </script>
    `;

    const { diagnostics } = parser.parseSvelteComponent(source, parseContext);
    const contextDiagnostic = diagnostics?.find((d) => d.kind === "context-any-type");

    expect(contextDiagnostic).toMatchObject({ kind: "context-any-type", name: "store", ignored: true });
  });

  test("the generics script attribute wins over @generics/@template JSDoc tags, flagged as syntax-skipped", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts" generics="Row extends DataTableRow = DataTableRow">
        /**
         * @generics {Header extends string = string} Header
         */
        interface DataTableRow {
          id: string | number;
        }

        let { row }: { row: Row } = $props();
      </script>
    `;

    const { diagnostics, generics } = parser.parseSvelteComponent(source, parseContext);
    const conflictDiagnostic = diagnostics?.find((d) => d.kind === "syntax-skipped" && d.name === "generics");

    expect(generics).toEqual(["Row", "Row extends DataTableRow = DataTableRow"]);
    expect(conflictDiagnostic).toBeDefined();
    expect(conflictDiagnostic?.message).toContain("JSDoc declaration was ignored");
    expect(conflictDiagnostic?.severity).toBe("error");
    expect(conflictDiagnostic?.code).toBe("sveld/syntax-skipped");
  });
});

describe("diagnostics helpers", () => {
  const make = (overrides: Partial<SveldDiagnosticInput>): SveldDiagnostic =>
    createDiagnostic({
      component: "./A.svelte",
      kind: "prop-unknown-type",
      name: "value",
      message: "message",
      ...overrides,
    });

  test("dedupeDiagnostics removes records with the same component, kind, and name", () => {
    const deduped = dedupeDiagnostics([make({}), make({}), make({ name: "other" })]);

    expect(deduped).toHaveLength(2);
    expect(deduped.map((d) => d.name)).toEqual(["value", "other"]);
  });

  test("dedupeDiagnostics collapses records that differ only in source", () => {
    const withSource = make({ source: { start: { line: 1, column: 0 }, end: { line: 1, column: 5 } } });
    const withoutSource = make({});

    const deduped = dedupeDiagnostics([withSource, withoutSource]);

    expect(deduped).toHaveLength(1);
  });

  test("formatDiagnosticsSummary reports a clean run", () => {
    expect(formatDiagnosticsSummary([])).toBe("sveld: all types resolved.");
  });

  test("formatDiagnosticsSummary groups records by kind and component", () => {
    const summary = formatDiagnosticsSummary([
      make({ kind: "prop-unknown-type", name: "value", message: "prop fallback" }),
      make({ kind: "event-no-source", name: "phantom", message: "event fallback" }),
    ]);

    expect(summary).toContain("2 unresolved types found.");
    expect(summary).toContain("Props without inferred types (1):");
    expect(summary).toContain("@event tags with no dispatch or callback (1):");
    expect(summary).toContain("prop fallback");
    expect(summary).toContain("event fallback");
  });

  test("formatDiagnosticsSummary appends the position when source is present", () => {
    const summary = formatDiagnosticsSummary([
      make({
        message: "prop fallback",
        source: { start: { line: 4, column: 2 }, end: { line: 4, column: 10 } },
      }),
    ]);

    expect(summary).toContain("prop fallback (./A.svelte:4:2)");
  });

  test("formatDiagnosticsSummary omits the position when source is absent", () => {
    const summary = formatDiagnosticsSummary([make({ message: "prop fallback" })]);

    expect(summary).toContain("- prop fallback");
    expect(summary).not.toContain("prop fallback (");
  });

  test("formatDiagnosticsSummaryJson serializes the diagnostics list with a kind discriminator", () => {
    const diagnostics = [make({ name: "value", message: "prop fallback" })];

    const json = formatDiagnosticsSummaryJson(diagnostics);

    expect(json.endsWith("\n")).toBe(true);
    expect(JSON.parse(json)).toEqual({ kind: "diagnostics", diagnostics });
  });

  test("formatDiagnosticsSummaryJson serializes an empty list", () => {
    expect(JSON.parse(formatDiagnosticsSummaryJson([]))).toEqual({ kind: "diagnostics", diagnostics: [] });
  });

  test("createDiagnostic fills in code and severity from kind", () => {
    expect(make({ kind: "prop-unknown-type" })).toMatchObject({ code: "sveld/prop-unknown-type", severity: "warning" });
    expect(make({ kind: "context-any-type" })).toMatchObject({ code: "sveld/context-any-type", severity: "warning" });
    expect(make({ kind: "event-no-source" })).toMatchObject({ code: "sveld/event-no-source", severity: "warning" });
    expect(make({ kind: "example-compile-error" })).toMatchObject({
      code: "sveld/example-compile-error",
      severity: "error",
    });
    expect(make({ kind: "syntax-skipped" })).toMatchObject({ code: "sveld/syntax-skipped", severity: "error" });
  });

  test("formatDiagnosticsSummary includes the code alongside the message", () => {
    const summary = formatDiagnosticsSummary([make({ message: "prop fallback" })]);

    expect(summary).toContain("prop fallback [sveld/prop-unknown-type]");
  });

  test("formatDiagnosticsSummary counts ignored diagnostics without including them in the total", () => {
    const summary = formatDiagnosticsSummary([
      make({ name: "a", message: "kept" }),
      make({ name: "b", message: "dropped", ignored: true }),
    ]);

    expect(summary).toContain("1 unresolved type found (1 ignored).");
    expect(summary).toContain("kept");
    expect(summary).not.toContain("dropped");
  });

  test("formatDiagnosticsSummary reports an all-ignored run distinctly from a clean one", () => {
    const summary = formatDiagnosticsSummary([make({ ignored: true })]);

    expect(summary).toBe("sveld: all types resolved (1 ignored).");
  });
});

describe("applyDiagnosticIgnores", () => {
  const make = (overrides: Partial<SveldDiagnosticInput>): SveldDiagnostic =>
    createDiagnostic({
      component: "./Legacy/Button.svelte",
      kind: "prop-unknown-type",
      name: "value",
      message: "message",
      ...overrides,
    });

  test("returns the input unchanged when there are no matchers", () => {
    const diagnostics = [make({})];
    expect(applyDiagnosticIgnores(diagnostics, undefined)).toBe(diagnostics);
    expect(applyDiagnosticIgnores(diagnostics, [])).toBe(diagnostics);
  });

  test("matches on code", () => {
    const [result] = applyDiagnosticIgnores([make({})], [{ code: "sveld/prop-unknown-type" }]);
    expect(result.ignored).toBe(true);
  });

  test("matches on name", () => {
    const [result] = applyDiagnosticIgnores([make({ name: "other" })], [{ name: "value" }]);
    expect(result.ignored).toBeFalsy();
  });

  test("matches component with a glob", () => {
    const [result] = applyDiagnosticIgnores([make({})], [{ component: "./Legacy/**" }]);
    expect(result.ignored).toBe(true);
  });

  test("a non-matching glob does not ignore", () => {
    const [result] = applyDiagnosticIgnores([make({})], [{ component: "./Modern/**" }]);
    expect(result.ignored).toBeFalsy();
  });

  test("every set field on a matcher must match", () => {
    const diagnostics = [make({})];
    const [result] = applyDiagnosticIgnores(diagnostics, [{ code: "sveld/prop-unknown-type", name: "nope" }]);
    expect(result.ignored).toBeFalsy();
  });

  test("preserves an already-ignored diagnostic when no matcher applies", () => {
    const [result] = applyDiagnosticIgnores([make({ ignored: true })], [{ name: "nope" }]);
    expect(result.ignored).toBe(true);
  });
});

describe("failingDiagnostics", () => {
  const warning = (overrides: Partial<SveldDiagnosticInput> = {}) =>
    createDiagnostic({ component: "./A.svelte", kind: "prop-unknown-type", name: "value", message: "m", ...overrides });
  const error = (overrides: Partial<SveldDiagnosticInput> = {}) =>
    createDiagnostic({
      component: "./A.svelte",
      kind: "example-compile-error",
      name: "value",
      message: "m",
      ...overrides,
    });

  test("returns nothing when strict is falsy", () => {
    expect(failingDiagnostics([warning(), error()], undefined)).toEqual([]);
    expect(failingDiagnostics([warning(), error()], false)).toEqual([]);
  });

  test("strict: true fails on both warnings and errors", () => {
    const diagnostics = [warning(), error()];
    expect(failingDiagnostics(diagnostics, true)).toEqual(diagnostics);
  });

  test('strict: "errors" fails only on error-severity diagnostics', () => {
    const w = warning();
    const e = error();
    expect(failingDiagnostics([w, e], "errors")).toEqual([e]);
  });

  test("ignored diagnostics never fail strict, regardless of severity", () => {
    const ignoredError = error({ ignored: true });
    expect(failingDiagnostics([ignoredError], true)).toEqual([]);
    expect(failingDiagnostics([ignoredError], "errors")).toEqual([]);
  });
});

describe("sveld() strict mode", () => {
  // `getSvelteEntry` resolves `entry` against `process.cwd()`, so the fixture
  // lives under cwd and is referenced by its relative directory name.
  let absoluteDir: string;
  let relativeDir: string;
  let previousExitCode: typeof process.exitCode;
  let errorSpy: ReturnType<typeof jest.spyOn>;
  let stderrSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousExitCode = process.exitCode;
    process.exitCode = undefined;
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    absoluteDir = mkdtempSync(join(process.cwd(), "sveld-diagnostics-"));
    relativeDir = basename(absoluteDir);
    // Component with an @event tag that has no dispatch or callback prop.
    writeFileSync(
      join(absoluteDir, "Phantom.svelte"),
      "<script>\n  /** @event {CustomEvent<null>} phantom */\n  export let label;\n</script>\n<button>{label}</button>\n",
    );
  });

  afterEach(() => {
    rmSync(absoluteDir, { recursive: true, force: true });
    process.exitCode = previousExitCode;
    jest.restoreAllMocks();
  });

  // `errorSpy` wraps the process-wide `console.error`, which other test files also spy on
  // concurrently under `bun test --parallel`. Assert on message content rather than call
  // count/order so unrelated, interleaved calls don't produce false positives/negatives.
  const summaryCalls = (spy: ReturnType<typeof jest.spyOn>) =>
    spy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .filter((message: string) => message.includes("unresolved types found"));

  test("returns the aggregated diagnostics array and stays non-failing by default", async () => {
    // Bun ignores `process.exitCode = undefined` once a numeric code has been
    // set earlier in the process, so assert against the pre-call value rather
    // than an unreachable literal `undefined`.
    const exitCodeBefore = process.exitCode;
    const { diagnostics } = await sveld({ entry: relativeDir, glob: true, types: false });

    expect(diagnostics.some((d) => d.kind === "event-no-source" && d.name === "phantom")).toBe(true);
    expect(process.exitCode).toBe(exitCodeBefore);
    expect(summaryCalls(errorSpy)).toHaveLength(0);
  });

  test("reportDiagnostics: true prints the summary to console.error", async () => {
    await sveld({ entry: relativeDir, glob: true, types: false, reportDiagnostics: true });

    expect(summaryCalls(errorSpy).length).toBeGreaterThan(0);
  });

  test("strict: true returns exitCode 4 without touching process.exitCode", async () => {
    const exitCodeBefore = process.exitCode;
    const { diagnostics, exitCode } = await sveld({ entry: relativeDir, glob: true, types: false, strict: true });

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(exitCode).toBe(4);
    expect(process.exitCode).toBe(exitCodeBefore);
    expect(summaryCalls(errorSpy).length).toBeGreaterThan(0);
  });

test("format: 'json' prints the diagnostics summary as JSON to stderr instead of text", async () => {
    await sveld({ entry: relativeDir, glob: true, types: false, reportDiagnostics: true, format: "json" });

    expect(summaryCalls(errorSpy)).toHaveLength(0);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const printed = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(printed.kind).toBe("diagnostics");
    expect(printed.diagnostics).toContainEqual(expect.objectContaining({ kind: "event-no-source", name: "phantom" }));
  });

  test("diagnostics.ignore marks the matching diagnostic ignored without touching the rest", async () => {
    const { diagnostics } = await sveld({
      entry: relativeDir,
      glob: true,
      types: false,
      diagnostics: { ignore: [{ name: "phantom" }] },
    });

    expect(diagnostics.find((d) => d.name === "phantom")?.ignored).toBe(true);
    expect(diagnostics.find((d) => d.name === "label")?.ignored).toBeFalsy();
  });

  test("diagnostics.ignore covering every diagnostic in the run clears strict: true", async () => {
    // `label` has no type annotation (a separate prop-unknown-type diagnostic
    // alongside phantom's event-no-source), so both names need a matcher.
    const { diagnostics, exitCode } = await sveld({
      entry: relativeDir,
      glob: true,
      types: false,
      strict: true,
      diagnostics: { ignore: [{ name: "phantom" }, { name: "label" }] },
    });

    expect(diagnostics.every((d) => d.ignored)).toBe(true);
    expect(exitCode).toBe(0);
  });

  test("diagnostics.ignore with a non-matching matcher still fails strict: true", async () => {
    const { exitCode } = await sveld({
      entry: relativeDir,
      glob: true,
      types: false,
      strict: true,
      diagnostics: { ignore: [{ name: "not-phantom" }] },
    });

    expect(exitCode).toBe(4);
  });
});
