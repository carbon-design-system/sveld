import type { SourceRange } from "./ComponentParser";
import { matchesGlob } from "./glob-match";

/**
 * Why sveld could not pin a type during parsing.
 *
 * - `prop-unknown-type`: prop `typeSource` is `"unknown"`.
 * - `context-any-type`: `setContext` value inferred as `any`.
 * - `event-no-source`: `@event` with no dispatch, forward, or callback prop.
 * - `example-compile-error`: an `@example` block failed to type-check (opt-in, `checkExamples`).
 * - `syntax-skipped`: `$props()`/`{@render}` syntax the parser can't model; omitted from output.
 */
export type SveldDiagnosticKind =
  | "prop-unknown-type"
  | "context-any-type"
  | "event-no-source"
  | "example-compile-error"
  | "syntax-skipped";

/** `"error"` fails `--strict=errors`; `"warning"` only fails plain `--strict`. */
export type SveldDiagnosticSeverity = "error" | "warning";

/**
 * Stable, namespaced identifier for a {@link SveldDiagnosticKind}, e.g.
 * `"sveld/prop-unknown-type"`. Safe to match on in CI config or an
 * `ignore` matcher; `kind` is kept as the bare, un-namespaced form for
 * compatibility.
 */
export const DIAGNOSTIC_CODES: Record<SveldDiagnosticKind, string> = {
  "prop-unknown-type": "sveld/prop-unknown-type",
  "context-any-type": "sveld/context-any-type",
  "event-no-source": "sveld/event-no-source",
  "example-compile-error": "sveld/example-compile-error",
  "syntax-skipped": "sveld/syntax-skipped",
};

/**
 * `example-compile-error` and `syntax-skipped` are errors (sveld emitted
 * broken or unmodeled output); the rest are warnings (a type fell back to
 * `any`).
 */
export const DIAGNOSTIC_SEVERITIES: Record<SveldDiagnosticKind, SveldDiagnosticSeverity> = {
  "prop-unknown-type": "warning",
  "context-any-type": "warning",
  "event-no-source": "warning",
  "example-compile-error": "error",
  "syntax-skipped": "error",
};

/**
 * One place sveld had to guess a type instead of inferring it.
 */
export interface SveldDiagnostic {
  /** File this came from, e.g. `"./Button.svelte"`. */
  component: string;
  kind: SveldDiagnosticKind;
  /** Stable, namespaced identifier for `kind` (e.g. `"sveld/prop-unknown-type"`). */
  code: string;
  severity: SveldDiagnosticSeverity;
  /** Prop, context field, or event name. */
  name: string;
  /** What went wrong and what type sveld used. */
  message: string;
  /** Where in the component source this diagnostic points, when the parser holds a stable position. */
  source?: SourceRange;
  /**
   * True when suppressed by an inline `@sveld-ignore` tag or a `diagnostics.ignore`
   * config matcher. Still present here (and counted in the summary) but never
   * fails `--strict` / `--strict=errors`.
   */
  ignored?: boolean;
}

/** Fields recordable at the point a diagnostic is discovered; `code`/`severity` are derived from `kind`. */
export type SveldDiagnosticInput = Omit<SveldDiagnostic, "code" | "severity">;

/** Builds a {@link SveldDiagnostic}, filling in `code`/`severity` from `kind`. */
export function createDiagnostic(input: SveldDiagnosticInput): SveldDiagnostic {
  return {
    ...input,
    code: DIAGNOSTIC_CODES[input.kind],
    severity: DIAGNOSTIC_SEVERITIES[input.kind],
  };
}

/**
 * Diagnostics that should fail `--strict` (`strict: true`) or `--strict=errors`
 * (`strict: "errors"`): never an `ignored` one, and only `severity: "error"`
 * ones under `"errors"`. Shared by the CLI and the programmatic `sveld()` API
 * so their exit-code contracts can't drift apart.
 */
export function failingDiagnostics(
  diagnostics: SveldDiagnostic[],
  strict: boolean | "errors" | undefined,
): SveldDiagnostic[] {
  if (!strict) return [];
  return diagnostics.filter(
    (diagnostic) => !diagnostic.ignored && (strict !== "errors" || diagnostic.severity === "error"),
  );
}

/**
 * One `diagnostics.ignore` entry. Every set field must match for the
 * matcher to apply; an omitted field matches anything. `component` is a
 * glob (`*`/`**`/`?`) matched against the diagnostic's `component` path.
 */
export interface DiagnosticIgnoreMatcher {
  code?: string;
  component?: string;
  name?: string;
}

function matchesIgnoreMatcher(diagnostic: SveldDiagnostic, matcher: DiagnosticIgnoreMatcher): boolean {
  if (matcher.code !== undefined && matcher.code !== diagnostic.code) return false;
  if (matcher.name !== undefined && matcher.name !== diagnostic.name) return false;
  if (matcher.component !== undefined && !matchesGlob(matcher.component, diagnostic.component)) return false;
  return true;
}

/**
 * Marks every diagnostic matching at least one `diagnostics.ignore` matcher
 * as `ignored`, on top of whatever inline `@sveld-ignore` tags already set.
 * Never un-ignores a diagnostic; only ever adds the flag.
 */
export function applyDiagnosticIgnores(
  diagnostics: SveldDiagnostic[],
  matchers: DiagnosticIgnoreMatcher[] | undefined,
): SveldDiagnostic[] {
  if (!matchers || matchers.length === 0) return diagnostics;

  return diagnostics.map((diagnostic) =>
    diagnostic.ignored || matchers.some((matcher) => matchesIgnoreMatcher(diagnostic, matcher))
      ? { ...diagnostic, ignored: true }
      : diagnostic,
  );
}

const KIND_LABELS: Record<SveldDiagnosticKind, string> = {
  "prop-unknown-type": "Props without inferred types",
  "context-any-type": "Context values typed as `any`",
  "event-no-source": "@event tags with no dispatch or callback",
  "example-compile-error": "@example blocks that failed to compile",
  "syntax-skipped": "Component syntax sveld skipped",
};

const KIND_ORDER: SveldDiagnosticKind[] = [
  "prop-unknown-type",
  "context-any-type",
  "event-no-source",
  "example-compile-error",
  "syntax-skipped",
];

/**
 * Drop duplicates (same component, kind, and name). Each file is parsed twice
 * when building exports and `.d.ts`, so without this the CLI summary doubles.
 */
export function dedupeDiagnostics(diagnostics: SveldDiagnostic[]): SveldDiagnostic[] {
  const seen = new Set<string>();
  const result: SveldDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.component}:${diagnostic.kind}:${diagnostic.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(diagnostic);
  }

  return result;
}

/**
 * Group diagnostics by kind and component for CLI output.
 */
export function formatDiagnosticsSummary(diagnostics: SveldDiagnostic[]): string {
  const active = diagnostics.filter((diagnostic) => !diagnostic.ignored);
  const ignoredCount = diagnostics.length - active.length;
  const ignoredSuffix = ignoredCount > 0 ? ` (${ignoredCount} ignored)` : "";

  if (active.length === 0) {
    return `sveld: all types resolved${ignoredSuffix}.`;
  }

  const lines: string[] = [];
  const total = active.length;
  lines.push(`sveld: ${total} unresolved type${total === 1 ? "" : "s"} found${ignoredSuffix}.`);

  for (const kind of KIND_ORDER) {
    const forKind = active.filter((diagnostic) => diagnostic.kind === kind);
    if (forKind.length === 0) continue;

    lines.push("");
    lines.push(`${KIND_LABELS[kind]} (${forKind.length}):`);

    const byComponent = new Map<string, SveldDiagnostic[]>();
    for (const diagnostic of forKind) {
      const group = byComponent.get(diagnostic.component) ?? [];
      group.push(diagnostic);
      byComponent.set(diagnostic.component, group);
    }

    for (const [component, group] of byComponent) {
      lines.push(`  ${component}`);
      for (const diagnostic of group) {
        const location = diagnostic.source
          ? ` (${component}:${diagnostic.source.start.line}:${diagnostic.source.start.column})`
          : "";
        lines.push(`    - ${diagnostic.message}${location} [${diagnostic.code}]`);
      }
    }
  }

  return lines.join("\n");
}

/** `SveldDiagnostic[]`, serialized for stream consumers with a `kind` discriminator. */
interface DiagnosticsJson {
  kind: "diagnostics";
  diagnostics: SveldDiagnostic[];
}

/** Serializes deduped diagnostics as JSON, for `--format=json --report-diagnostics` / `--strict`. */
export function formatDiagnosticsSummaryJson(diagnostics: SveldDiagnostic[]): string {
  const document: DiagnosticsJson = { kind: "diagnostics", diagnostics };
  return `${JSON.stringify(document, null, 2)}\n`;
}
