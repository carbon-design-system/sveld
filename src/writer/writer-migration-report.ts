import path from "node:path";
import { info } from "../logger";
import { normalizeSeparators } from "../path";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { buildComponentApiDocument } from "./document-model";
import Writer from "./Writer";

export interface WriteMigrationReportOptions {
  outDir?: string;
  /** @internal Report the resolved paths instead of writing. Always set by the caller from `sveld --dry-run`. */
  dryRun?: boolean;
}

export interface MigrationReportCounts {
  /** Legacy `export let` props (0 for runes components). */
  exportLet: number;
  /** Bare `on:event` forwarded-event directives. */
  onDirectives: number;
  /** `<slot>` (legacy) or `{@render}` snippet (runes) declarations. */
  slots: number;
  /** `createEventDispatcher()`-style dispatched events. */
  createEventDispatcher: number;
  /** `$$restProps` usage (0 for runes components; runes rest-destructuring isn't migration debt). */
  restPropsLegacy: number;
  /** Top-level `$:` reactive-statement labels. */
  reactiveStatements: number;
}

export interface MigrationReportComponentEntry {
  moduleName: string;
  filePath: string;
  syntaxMode: "legacy" | "runes";
  counts: MigrationReportCounts;
  /** 0-100 readiness heuristic; see `WEIGHTS` and the README's "Migration report" section for the caveat. */
  score: number;
}

export interface MigrationReportSummary {
  totalComponents: number;
  byMode: { legacy: number; runes: number };
  /** Mean `score` across every component, rounded to the nearest integer. */
  meanScore: number;
  /** The ten lowest-scoring components, ascending. */
  lowestScoring: Array<Pick<MigrationReportComponentEntry, "moduleName" | "filePath" | "score">>;
}

export interface MigrationReportDocument {
  schemaVersion: 1;
  generator: { name: string; version: string; svelteVersion: string };
  components: MigrationReportComponentEntry[];
  summary: MigrationReportSummary;
}

/**
 * Points subtracted from 100 per occurrence of each count, for a legacy
 * component's readiness score. A runes component always scores 100,
 * regardless of these counts, since it has already migrated. Documented in
 * the README so the weighting isn't a black box.
 */
export const MIGRATION_REPORT_SCORE_WEIGHTS: Record<keyof MigrationReportCounts, number> = {
  exportLet: 2,
  onDirectives: 4,
  slots: 5,
  createEventDispatcher: 6,
  restPropsLegacy: 10,
  reactiveStatements: 3,
};

const LOWEST_SCORING_LIMIT = 10;

function computeCounts(component: ComponentDocApi): MigrationReportCounts {
  const isLegacy = component.syntaxMode === "legacy";

  return {
    exportLet: isLegacy ? component.props.filter((prop) => prop.kind === "let").length : 0,
    onDirectives: component.events.filter((event) => event.type === "forwarded").length,
    slots: component.slots.length,
    createEventDispatcher: component.events.filter((event) => event.type === "dispatched").length,
    restPropsLegacy: isLegacy && component.rest_props !== undefined ? 1 : 0,
    reactiveStatements: component.reactiveStatementCount,
  };
}

/**
 * 100 for a runes component (already migrated); otherwise 100 minus each
 * count weighted by {@link MIGRATION_REPORT_SCORE_WEIGHTS}, capped at 0. A
 * directional heuristic, not an authoritative migration cost estimate - see
 * the README's "Migration report" section.
 */
function computeScore(syntaxMode: "legacy" | "runes", counts: MigrationReportCounts): number {
  if (syntaxMode === "runes") return 100;

  let deduction = 0;
  for (const key of Object.keys(MIGRATION_REPORT_SCORE_WEIGHTS) as Array<keyof MigrationReportCounts>) {
    deduction += counts[key] * MIGRATION_REPORT_SCORE_WEIGHTS[key];
  }

  return Math.max(0, 100 - deduction);
}

function buildSummary(entries: MigrationReportComponentEntry[]): MigrationReportSummary {
  const byMode = { legacy: 0, runes: 0 };
  let scoreTotal = 0;
  for (const entry of entries) {
    byMode[entry.syntaxMode] += 1;
    scoreTotal += entry.score;
  }

  return {
    totalComponents: entries.length,
    byMode,
    meanScore: entries.length === 0 ? 0 : Math.round(scoreTotal / entries.length),
    lowestScoring: entries
      .slice(0, LOWEST_SCORING_LIMIT)
      .map(({ moduleName, filePath, score }) => ({ moduleName, filePath, score })),
  };
}

/**
 * Renders the migration readiness document (sorted by `score` ascending, so
 * the least-migrated components lead) without touching disk. Used by both
 * `writeMigrationReport` and tests.
 */
export function renderMigrationReportDocument(components: ComponentDocs): MigrationReportDocument {
  const document = buildComponentApiDocument(components);

  const entries = document.components
    .map((component): MigrationReportComponentEntry => {
      const counts = computeCounts(component);
      return {
        moduleName: component.moduleName,
        filePath: component.filePath,
        syntaxMode: component.syntaxMode,
        counts,
        score: computeScore(component.syntaxMode, counts),
      };
    })
    .sort((a, b) => a.score - b.score);

  return {
    schemaVersion: 1,
    generator: document.generator,
    components: entries,
    summary: buildSummary(entries),
  };
}

const COUNT_COLUMNS: Array<{ key: keyof MigrationReportCounts; header: string }> = [
  { key: "exportLet", header: "Export let" },
  { key: "onDirectives", header: "on: forwarded" },
  { key: "slots", header: "Slots/Snippets" },
  { key: "createEventDispatcher", header: "dispatchEvent" },
  { key: "restPropsLegacy", header: "$$restProps" },
  { key: "reactiveStatements", header: "$: statements" },
];

/** Renders the Markdown report for a document already built by {@link renderMigrationReportDocument}. */
export function renderMigrationReportMarkdown(report: MigrationReportDocument): string {
  const lines: string[] = [];

  lines.push("# Migration Readiness Report", "");
  lines.push(
    `${report.summary.totalComponents} component${report.summary.totalComponents === 1 ? "" : "s"} - ` +
      `${report.summary.byMode.runes} runes, ${report.summary.byMode.legacy} legacy - ` +
      `mean readiness score **${report.summary.meanScore}**.`,
    "",
  );

  const headerCells = ["Component", "Mode", "Score", ...COUNT_COLUMNS.map((column) => column.header)];
  lines.push(`| ${headerCells.join(" | ")} |`);
  lines.push(`| ${headerCells.map(() => ":-").join(" | ")} |`);

  for (const entry of report.components) {
    const cells = [
      entry.moduleName,
      entry.syntaxMode,
      String(entry.score),
      ...COUNT_COLUMNS.map((column) => String(entry.counts[column.key])),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Writes `MIGRATION_REPORT.json` and `MIGRATION_REPORT.md`: a per-component
 * Svelte 5 migration readiness heuristic (`syntaxMode`, legacy-pattern
 * counts, and a 0-100 score), plus a library-wide rollup. See the README's
 * "Migration report" section for the score's weights and its caveat.
 *
 * @example
 * ```ts
 * await writeMigrationReport(components, { outDir: "." });
 * ```
 */
export default async function writeMigrationReport(components: ComponentDocs, options: WriteMigrationReportOptions) {
  const report = renderMigrationReportDocument(components);
  const writer = new Writer({ dryRun: options.dryRun });

  const jsonRelPath = normalizeSeparators(path.join(options.outDir ?? "", "MIGRATION_REPORT.json"));
  const mdRelPath = normalizeSeparators(path.join(options.outDir ?? "", "MIGRATION_REPORT.md"));

  const [jsonWritten, mdWritten] = await Promise.all([
    writer.write(path.join(process.cwd(), jsonRelPath), `${JSON.stringify(report, null, 2)}\n`),
    writer.write(path.join(process.cwd(), mdRelPath), renderMigrationReportMarkdown(report)),
  ]);

  if (!options.dryRun) {
    info(`${jsonWritten ? "created" : "unchanged"} "${jsonRelPath}".`);
    info(`${mdWritten ? "created" : "unchanged"} "${mdRelPath}".`);
  }
}
