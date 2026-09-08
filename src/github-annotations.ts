import { type ApiChange, bumpMeetsLevel, type CheckLevel, type CheckResult } from "./check";
import type { SveldDiagnostic, SveldDiagnosticSeverity } from "./diagnostics";

const PERCENT_REGEX = /%/g;
const CARRIAGE_RETURN_REGEX = /\r/g;
const NEWLINE_REGEX = /\n/g;
const COMMA_REGEX = /,/g;
const COLON_REGEX = /:/g;
const PIPE_REGEX = /\|/g;

/** Escapes the handful of characters GitHub's workflow-command format treats specially in a `key=value` property. */
function escapeProperty(value: string): string {
  return value
    .replace(PERCENT_REGEX, "%25")
    .replace(CARRIAGE_RETURN_REGEX, "%0D")
    .replace(NEWLINE_REGEX, "%0A")
    .replace(COMMA_REGEX, "%2C")
    .replace(COLON_REGEX, "%3A");
}

/** Escapes the handful of characters GitHub's workflow-command format treats specially in the message body. */
function escapeMessage(value: string): string {
  return value.replace(PERCENT_REGEX, "%25").replace(CARRIAGE_RETURN_REGEX, "%0D").replace(NEWLINE_REGEX, "%0A");
}

function annotationLine(
  level: SveldDiagnosticSeverity,
  title: string,
  message: string,
  file?: string,
  line?: number,
  col?: number,
): string {
  const command = level === "error" ? "error" : "warning";
  const properties: string[] = [];
  if (file !== undefined) properties.push(`file=${escapeProperty(file)}`);
  if (line !== undefined) properties.push(`line=${line}`);
  if (col !== undefined) properties.push(`col=${col}`);
  properties.push(`title=${escapeProperty(title)}`);
  return `::${command} ${properties.join(",")}::${escapeMessage(message)}`;
}

/** Diagnostics as GitHub Actions workflow commands, one `::error`/`::warning` line per active (non-ignored) diagnostic. */
export function formatDiagnosticsGitHub(diagnostics: SveldDiagnostic[]): string {
  return diagnostics
    .filter((diagnostic) => !diagnostic.ignored)
    .map((diagnostic) =>
      annotationLine(
        diagnostic.severity,
        `sveld ${diagnostic.code}`,
        diagnostic.message,
        diagnostic.component,
        diagnostic.source?.start.line,
        diagnostic.source?.start.column,
      ),
    )
    .join("\n");
}

/** Diagnostics as a `GITHUB_STEP_SUMMARY` Markdown table, mirroring `formatDiagnosticsGitHub`'s rows. */
export function formatDiagnosticsGitHubSummary(diagnostics: SveldDiagnostic[]): string {
  const active = diagnostics.filter((diagnostic) => !diagnostic.ignored);
  if (active.length === 0) return "";

  const rows = active.map((diagnostic) => {
    const location = diagnostic.source
      ? `${diagnostic.component}:${diagnostic.source.start.line}`
      : diagnostic.component;
    return `| ${diagnostic.severity} | ${diagnostic.code} | ${location} | ${diagnostic.message.replace(PIPE_REGEX, "\\|")} |`;
  });

  return [
    "### sveld diagnostics",
    "",
    "| Severity | Code | Location | Message |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

/** `--check` changes that meet or exceed `level` and become GitHub error annotations. */
function failingChanges(result: CheckResult, level: CheckLevel): ApiChange[] {
  return result.changes.filter((change) => bumpMeetsLevel(change.bump, level));
}

/** `--check` changes at or above `level` as GitHub Actions `::error` workflow commands. */
export function formatCheckGitHub(result: CheckResult, level: CheckLevel): string {
  return failingChanges(result, level)
    .map((change) =>
      annotationLine(
        "error",
        "sveld breaking change",
        change.message,
        change.component === "*" ? undefined : change.component,
      ),
    )
    .join("\n");
}

/** `--check` changes at or above `level` as a `GITHUB_STEP_SUMMARY` Markdown table, mirroring `formatCheckGitHub`'s rows. */
export function formatCheckGitHubSummary(result: CheckResult, level: CheckLevel): string {
  const changes = failingChanges(result, level);
  if (changes.length === 0) return "";

  const rows = changes.map(
    (change) => `| ${change.component} | ${change.kind} | ${change.message.replace(PIPE_REGEX, "\\|")} |`,
  );

  return ["### sveld breaking changes", "", "| Component | Kind | Message |", "| --- | --- | --- |", ...rows].join(
    "\n",
  );
}
