import type { SourceRange } from "./ComponentParser";
import { formatJsonOutput } from "./path";

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

/**
 * One place sveld had to guess a type instead of inferring it.
 */
export interface SveldDiagnostic {
  /** File this came from, e.g. `"./Button.svelte"`. */
  component: string;
  kind: SveldDiagnosticKind;
  /** Prop, context field, or event name. */
  name: string;
  /** What went wrong and what type sveld used. */
  message: string;
  /** Where in the component source this diagnostic points, when the parser holds a stable position. */
  source?: SourceRange;
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
  if (diagnostics.length === 0) {
    return "sveld: all types resolved.";
  }

  const lines: string[] = [];
  const total = diagnostics.length;
  lines.push(`sveld: ${total} unresolved type${total === 1 ? "" : "s"} found.`);

  for (const kind of KIND_ORDER) {
    const forKind = diagnostics.filter((diagnostic) => diagnostic.kind === kind);
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
        lines.push(`    - ${diagnostic.message}${location}`);
      }
    }
  }

  return lines.join("\n");
}

/** `SveldDiagnostic[]`, serialized for stream consumers with a `kind` discriminator. */
export interface DiagnosticsJson {
  kind: "diagnostics";
  diagnostics: SveldDiagnostic[];
}

/** Serializes deduped diagnostics as JSON, for `--format=json --report-diagnostics` / `--strict`. */
export function formatDiagnosticsSummaryJson(diagnostics: SveldDiagnostic[]): string {
  const document: DiagnosticsJson = { kind: "diagnostics", diagnostics };
  return formatJsonOutput(document);
}
