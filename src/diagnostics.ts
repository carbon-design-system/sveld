import type { SourceRange } from "./ComponentParser";
import { matchesGlob } from "./glob-match";

/**
 * Why sveld could not pin a type during parsing.
 *
 * - `prop-unknown-type`: prop `typeSource` is `"unknown"`.
 * - `context-any-type`: `setContext` value inferred as `any`.
 * - `event-no-source`: `@event` with no dispatch, forward, or callback prop.
 * - `example-compile-error`: a TS/JS `@example` block failed to type-check (opt-in, `checkExamples`).
 * - `example-syntax-error`: a `svelte`/`html` `@example` block failed to parse (opt-in, `checkExamples`).
 * - `syntax-skipped`: `$props()`/`{@render}` syntax the parser can't model; omitted from output.
 * - `rest-props-unresolved`: every `{...$$restProps}` target was a component, so `$RestProps` couldn't be typed.
 * - `context-duplicate-key`: `setContext` called more than once with the same key; only the first call's shape is used.
 * - `spread-unresolved`: a `{...spread}` in a context or slot-props object literal couldn't be resolved; widened to `Record<string, any>`.
 * - `export-unresolved`: a named export specifier (re-export or renamed import) couldn't be resolved to a local declaration.
 * - `extend-props-target-missing`: an `@extends`/`@extendProps` target file wasn't found, or its named interface doesn't match the bundled component it points at.
 * - `extend-props-duplicate`: a second `@extends`/`@extendProps` tag overwrote the first.
 * - `extend-props-override`: an own prop has the same name as an `@extends` target's prop but a different type.
 * - `jsdoc-unknown-tag`: a JSDoc tag sveld doesn't recognize (e.g. a typo like `@depreacted`); passed through unchanged, surfaced only under `--strict`/`--report-diagnostics`.
 * - `typedef-duplicate`: a second `@typedef`/`@callback` reused a name; the later declaration overwrites the earlier one.
 * - `property-duplicate`: a second `@property` reused a name on the same `@event`/`@typedef`; the later declaration overwrites the earlier one.
 * - `generics-conflict`: a second `@generics`/`@template` reused a generic name.
 * - `jsdoc-tag-dropped`: a passthrough JSDoc tag (e.g. `@see`) couldn't attach to a following or preceding structural tag.
 * - `internal-typedef-referenced`: a public prop/typedef/event/slot/module-export/context type references an `@internal` typedef by name, which is excluded from output; the generated `.d.ts` will contain a dangling reference.
 */
export type SveldDiagnosticKind =
  | "prop-unknown-type"
  | "context-any-type"
  | "event-no-source"
  | "example-compile-error"
  | "example-syntax-error"
  | "syntax-skipped"
  | "rest-props-unresolved"
  | "context-duplicate-key"
  | "spread-unresolved"
  | "export-unresolved"
  | "extend-props-target-missing"
  | "extend-props-duplicate"
  | "extend-props-override"
  | "jsdoc-unknown-tag"
  | "typedef-duplicate"
  | "property-duplicate"
  | "generics-conflict"
  | "jsdoc-tag-dropped"
  | "internal-typedef-referenced";

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
  "example-syntax-error": "sveld/example-syntax-error",
  "syntax-skipped": "sveld/syntax-skipped",
  "rest-props-unresolved": "sveld/rest-props-unresolved",
  "context-duplicate-key": "sveld/context-duplicate-key",
  "spread-unresolved": "sveld/spread-unresolved",
  "export-unresolved": "sveld/export-unresolved",
  "extend-props-target-missing": "sveld/extend-props-target-missing",
  "extend-props-duplicate": "sveld/extend-props-duplicate",
  "extend-props-override": "sveld/extend-props-override",
  "jsdoc-unknown-tag": "sveld/jsdoc-unknown-tag",
  "typedef-duplicate": "sveld/typedef-duplicate",
  "property-duplicate": "sveld/property-duplicate",
  "generics-conflict": "sveld/generics-conflict",
  "jsdoc-tag-dropped": "sveld/jsdoc-tag-dropped",
  "internal-typedef-referenced": "sveld/internal-typedef-referenced",
};

/**
 * `example-compile-error`, `example-syntax-error`, and `syntax-skipped` are
 * errors (sveld emitted broken or unmodeled output); the rest are warnings
 * (a type fell back to `any`).
 */
export const DIAGNOSTIC_SEVERITIES: Record<SveldDiagnosticKind, SveldDiagnosticSeverity> = {
  "prop-unknown-type": "warning",
  "context-any-type": "warning",
  "event-no-source": "warning",
  "example-compile-error": "error",
  "example-syntax-error": "error",
  "syntax-skipped": "error",
  "rest-props-unresolved": "warning",
  "context-duplicate-key": "warning",
  "spread-unresolved": "warning",
  "export-unresolved": "warning",
  "extend-props-target-missing": "error",
  "extend-props-duplicate": "warning",
  "extend-props-override": "warning",
  "jsdoc-unknown-tag": "warning",
  "typedef-duplicate": "warning",
  "property-duplicate": "warning",
  "generics-conflict": "warning",
  "jsdoc-tag-dropped": "warning",
  "internal-typedef-referenced": "error",
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
 * `jsdoc-unknown-tag` is speculative: a misspelled tag (`@depreacted`) and an
 * intentional custom tag look identical to the parser, so it's noisier than
 * the rest of the codes. Surface it only when the caller opted into
 * diagnostics via `--strict`/`--report-diagnostics`; a plain run stays quiet
 * about tags sveld already passes through unchanged.
 */
export function filterSpeculativeDiagnostics(
  diagnostics: SveldDiagnostic[],
  shouldReport: boolean | "errors" | undefined,
): SveldDiagnostic[] {
  if (shouldReport) return diagnostics;
  return diagnostics.filter((diagnostic) => diagnostic.kind !== "jsdoc-unknown-tag");
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
  "example-syntax-error": "@example blocks that failed to parse",
  "syntax-skipped": "Component syntax sveld skipped",
  "rest-props-unresolved": "$$restProps spread only onto components",
  "context-duplicate-key": "Duplicate setContext keys",
  "spread-unresolved": "Unresolved spreads widened to Record<string, any>",
  "export-unresolved": "Unresolved named export specifiers",
  "extend-props-target-missing": "@extends/@extendProps targets that couldn't be verified",
  "extend-props-duplicate": "Duplicate @extends/@extendProps tags",
  "extend-props-override": "Own props overriding an @extends target's prop",
  "jsdoc-unknown-tag": "Unknown JSDoc tags",
  "typedef-duplicate": "Duplicate @typedef/@callback names",
  "property-duplicate": "Duplicate @property names",
  "generics-conflict": "Duplicate @generics/@template names",
  "jsdoc-tag-dropped": "Passthrough JSDoc tags that couldn't attach",
  "internal-typedef-referenced": "Public types referencing an @internal typedef",
};

const KIND_ORDER: SveldDiagnosticKind[] = [
  "prop-unknown-type",
  "context-any-type",
  "event-no-source",
  "example-compile-error",
  "example-syntax-error",
  "syntax-skipped",
  "rest-props-unresolved",
  "context-duplicate-key",
  "spread-unresolved",
  "export-unresolved",
  "extend-props-target-missing",
  "extend-props-duplicate",
  "extend-props-override",
  "jsdoc-unknown-tag",
  "typedef-duplicate",
  "property-duplicate",
  "generics-conflict",
  "jsdoc-tag-dropped",
  "internal-typedef-referenced",
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

/** Envelope schema version for {@link DiagnosticsJson}. Bump when the shape of `diagnostics` changes incompatibly. */
export const DIAGNOSTICS_SCHEMA_VERSION = 1;

/** `SveldDiagnostic[]`, serialized for stream consumers with a `kind` discriminator. */
export interface DiagnosticsJson {
  kind: "diagnostics";
  schemaVersion: typeof DIAGNOSTICS_SCHEMA_VERSION;
  diagnostics: SveldDiagnostic[];
}

/** Serializes deduped diagnostics as JSON, for `--format=json --report-diagnostics` / `--strict`. */
export function formatDiagnosticsSummaryJson(diagnostics: SveldDiagnostic[]): string {
  const document: DiagnosticsJson = { kind: "diagnostics", schemaVersion: DIAGNOSTICS_SCHEMA_VERSION, diagnostics };
  return `${JSON.stringify(document, null, 2)}\n`;
}
