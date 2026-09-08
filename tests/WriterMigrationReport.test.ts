import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import type { ComponentProp, SerializedComponentEvent } from "../src/ComponentParser";
import { setQuiet } from "../src/logger";
import { normalizeSeparators } from "../src/path";
import type { ComponentDocs } from "../src/plugin";
import writeMigrationReport, {
  MIGRATION_REPORT_SCORE_WEIGHTS,
  renderMigrationReportDocument,
  renderMigrationReportMarkdown,
} from "../src/writer/writer-migration-report";
import { mockComponentDocApi } from "./test-brands";

function mockProp(name: string, overrides?: Partial<ComponentProp>): ComponentProp {
  return {
    name,
    kind: "let",
    constant: false,
    isFunction: false,
    isFunctionDeclaration: false,
    isRequired: true,
    reactive: false,
    ...overrides,
  };
}

function mockForwardedEvent(name: string): SerializedComponentEvent {
  return { type: "forwarded", name } as SerializedComponentEvent;
}

function mockDispatchedEvent(name: string): SerializedComponentEvent {
  return { type: "dispatched", name } as SerializedComponentEvent;
}

const LEADING_TABLE_PIPE_REGEX = /^\|\s*/;

// Pure-legacy fixture: every legacy migration-debt pattern present at least once.
const legacyButton = mockComponentDocApi("Button", "Button.svelte", {
  syntaxMode: "legacy",
  props: [mockProp("label"), mockProp("size", { kind: "let" })],
  events: [mockForwardedEvent("click"), mockDispatchedEvent("close")],
  slots: [{ default: true }],
  rest_props: { type: "Element", name: "div" },
  reactiveStatementCount: 2,
});

const legacyModal = mockComponentDocApi("Modal", "Modal.svelte", {
  syntaxMode: "legacy",
  props: [mockProp("open")],
  events: [],
  slots: [{ default: true }, { default: false, name: "footer" }],
});

const pureLegacyComponents: ComponentDocs = new Map([
  ["Button", legacyButton],
  ["Modal", legacyModal],
]);

// Pure-runes fixture: same shapes as the legacy components (forwarded events,
// slots/snippets), but already migrated, so every count-driving pattern that
// still appears must not affect the score.
const runesButton = mockComponentDocApi("RunesButton", "RunesButton.svelte", {
  syntaxMode: "runes",
  props: [mockProp("label")],
  events: [mockForwardedEvent("click"), mockDispatchedEvent("close")],
  slots: [{ default: true }],
  reactiveStatementCount: 2,
});

const runesModal = mockComponentDocApi("RunesModal", "RunesModal.svelte", {
  syntaxMode: "runes",
  props: [],
  slots: [{ default: false, name: "footer" }],
});

const pureRunesComponents: ComponentDocs = new Map([
  ["RunesButton", runesButton],
  ["RunesModal", runesModal],
]);

// Mixed-library fixture: enough components (with distinct scores) to exercise
// the rollup's byMode totals, mean score, and the lowest-ten cap.
function mockLegacyWithExportLetCount(name: string, exportLetCount: number) {
  return mockComponentDocApi(name, `${name}.svelte`, {
    syntaxMode: "legacy",
    props: Array.from({ length: exportLetCount }, (_, index) => mockProp(`prop${index}`)),
  });
}

const mixedComponents: ComponentDocs = new Map([
  ...Array.from(
    { length: 11 },
    (_, index) => [`Legacy${index}`, mockLegacyWithExportLetCount(`Legacy${index}`, index + 1)] as const,
  ),
  ["RunesOnly", mockComponentDocApi("RunesOnly", "RunesOnly.svelte", { syntaxMode: "runes" })] as const,
]);

describe("renderMigrationReportDocument", () => {
  test("counts legacy migration-debt patterns and derives a weighted score", () => {
    const report = renderMigrationReportDocument(pureLegacyComponents);
    const button = report.components.find((c) => c.moduleName === "Button");

    expect(button?.counts).toEqual({
      exportLet: 2,
      onDirectives: 1,
      slots: 1,
      createEventDispatcher: 1,
      restPropsLegacy: 1,
      reactiveStatements: 2,
    });

    const expectedScore =
      100 -
      (2 * MIGRATION_REPORT_SCORE_WEIGHTS.exportLet +
        1 * MIGRATION_REPORT_SCORE_WEIGHTS.onDirectives +
        1 * MIGRATION_REPORT_SCORE_WEIGHTS.slots +
        1 * MIGRATION_REPORT_SCORE_WEIGHTS.createEventDispatcher +
        1 * MIGRATION_REPORT_SCORE_WEIGHTS.restPropsLegacy +
        2 * MIGRATION_REPORT_SCORE_WEIGHTS.reactiveStatements);
    expect(button?.score).toBe(expectedScore);
  });

  test("caps a heavily-flagged legacy component's score at 0", () => {
    const overloaded = mockComponentDocApi("Overloaded", "Overloaded.svelte", {
      syntaxMode: "legacy",
      props: Array.from({ length: 50 }, (_, index) => mockProp(`prop${index}`)),
    });

    const report = renderMigrationReportDocument(new Map([["Overloaded", overloaded]]));
    expect(report.components[0]?.score).toBe(0);
  });

  test("a runes component always scores 100, regardless of remaining forwarded events/slots", () => {
    const report = renderMigrationReportDocument(pureRunesComponents);

    for (const component of report.components) {
      expect(component.syntaxMode).toBe("runes");
      expect(component.score).toBe(100);
    }

    // The counts are still reported (informational), just not scored against.
    const runesButtonEntry = report.components.find((c) => c.moduleName === "RunesButton");
    expect(runesButtonEntry?.counts.onDirectives).toBe(1);
    expect(runesButtonEntry?.counts.createEventDispatcher).toBe(1);
    // Legacy-only counters are always 0 in runes mode.
    expect(runesButtonEntry?.counts.exportLet).toBe(0);
    expect(runesButtonEntry?.counts.restPropsLegacy).toBe(0);
  });

  test("components are sorted by score ascending", () => {
    const report = renderMigrationReportDocument(mixedComponents);
    const scores = report.components.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  test("summary rolls up totals by mode, mean score, and the ten lowest-scoring components", () => {
    const report = renderMigrationReportDocument(mixedComponents);

    expect(report.summary.totalComponents).toBe(12);
    expect(report.summary.byMode).toEqual({ legacy: 11, runes: 1 });

    const expectedMean = Math.round(
      report.components.reduce((total, c) => total + c.score, 0) / report.components.length,
    );
    expect(report.summary.meanScore).toBe(expectedMean);

    expect(report.summary.lowestScoring).toHaveLength(10);
    expect(report.summary.lowestScoring).toEqual(
      report.components.slice(0, 10).map(({ moduleName, filePath, score }) => ({ moduleName, filePath, score })),
    );
  });

  test("JSON document matches schema/migration-report.schema.json", () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    const schema = JSON.parse(readFileSync(join(process.cwd(), "schema", "migration-report.schema.json"), "utf-8"));
    const validate = ajv.compile(schema);

    for (const components of [pureLegacyComponents, pureRunesComponents, mixedComponents]) {
      const report = renderMigrationReportDocument(components);
      const valid = validate(report);
      if (!valid) {
        throw new Error(`Schema validation failed:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
      }
      expect(valid).toBe(true);
    }
  });
});

describe("renderMigrationReportMarkdown", () => {
  test("leads with the rollup line, then one table sorted by score ascending", () => {
    const report = renderMigrationReportDocument(pureLegacyComponents);
    const markdown = renderMigrationReportMarkdown(report);

    expect(markdown).toStartWith("# Migration Readiness Report\n\n");
    expect(markdown).toContain("2 components - 0 runes, 2 legacy - mean readiness score");

    const moduleNameOrder = report.components.map((c) => c.moduleName);
    const tableStart = markdown.indexOf("| Component |");
    const rows = markdown
      .slice(tableStart)
      .split("\n")
      .filter((line) => line.startsWith("| ") && !line.startsWith("| Component") && !line.startsWith("| :-"));
    expect(rows.map((row) => row.split(" | ")[0]?.replace(LEADING_TABLE_PIPE_REGEX, ""))).toEqual(moduleNameOrder);
  });
});

describe("writeMigrationReport", () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setQuiet(false);
    jest.restoreAllMocks();
  });

  test("writes MIGRATION_REPORT.json and MIGRATION_REPORT.md to outDir", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sveld-migration-report-"));
    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      await writeMigrationReport(pureLegacyComponents, { outDir: "docs" });

      const report = renderMigrationReportDocument(pureLegacyComponents);
      expect(JSON.parse(readFileSync(join(tempDir, "docs", "MIGRATION_REPORT.json"), "utf-8"))).toEqual(report);
      expect(readFileSync(join(tempDir, "docs", "MIGRATION_REPORT.md"), "utf-8")).toBe(
        renderMigrationReportMarkdown(report),
      );
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('created "docs/MIGRATION_REPORT.json".'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('created "docs/MIGRATION_REPORT.md".'));

      errorSpy.mockClear();
      await writeMigrationReport(pureLegacyComponents, { outDir: "docs" });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('unchanged "docs/MIGRATION_REPORT.json".'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('unchanged "docs/MIGRATION_REPORT.md".'));
    } finally {
      process.chdir(previousCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("dry-run reports the resolved paths and writes nothing to disk", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sveld-migration-report-dry-run-"));
    const previousCwd = process.cwd();
    process.chdir(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await writeMigrationReport(pureLegacyComponents, { dryRun: true });

      const cwd = process.cwd();
      expect(existsSync(join(tempDir, "MIGRATION_REPORT.json"))).toBe(false);
      expect(existsSync(join(tempDir, "MIGRATION_REPORT.md"))).toBe(false);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`would write "${normalizeSeparators(join(cwd, "MIGRATION_REPORT.json"))}"`),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`would write "${normalizeSeparators(join(cwd, "MIGRATION_REPORT.md"))}"`),
      );
    } finally {
      process.chdir(previousCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
