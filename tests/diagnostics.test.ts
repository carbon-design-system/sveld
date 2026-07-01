import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import ComponentParser from "../src/ComponentParser";
import { dedupeDiagnostics, formatDiagnosticsSummary, type SveldDiagnostic } from "../src/diagnostics";
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
      name: "value",
    });
    expect(typeof propDiagnostic?.message).toBe("string");
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
});

describe("diagnostics helpers", () => {
  const make = (overrides: Partial<SveldDiagnostic>): SveldDiagnostic => ({
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
});

describe("sveld() strict mode", () => {
  // `getSvelteEntry` resolves `input` against `process.cwd()`, so the fixture
  // lives under cwd and is referenced by its relative directory name.
  let absoluteDir: string;
  let relativeDir: string;
  let previousExitCode: typeof process.exitCode;
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    previousExitCode = process.exitCode;
    process.exitCode = undefined;
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
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

  test("returns the aggregated diagnostics array and stays non-failing by default", async () => {
    const { diagnostics } = await sveld({ input: relativeDir, glob: true, types: false });

    expect(diagnostics.some((d) => d.kind === "event-no-source" && d.name === "phantom")).toBe(true);
    expect(process.exitCode).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("reportDiagnostics: true prints the summary", async () => {
    await sveld({ input: relativeDir, glob: true, types: false, reportDiagnostics: true });

    expect(warnSpy).toHaveBeenCalled();
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("unresolved types found");
  });

  test("strict: true sets a non-zero exit code when diagnostics exist", async () => {
    const { diagnostics } = await sveld({ input: relativeDir, glob: true, types: false, strict: true });

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(process.exitCode).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
  });
});
