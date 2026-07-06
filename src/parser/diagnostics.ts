import type { SourceRange } from "../ComponentParser";
import type { SveldDiagnosticKind } from "../diagnostics";
import type { ParserContext } from "./context";

/**
 * Appends a diagnostic (a place sveld had to guess a type) to `ctx.diagnosticRecords`,
 * tagged with the file path of the component currently being parsed.
 */
export function recordDiagnostic(
  ctx: ParserContext,
  kind: SveldDiagnosticKind,
  name: string,
  message: string,
  source?: SourceRange,
) {
  ctx.diagnosticRecords.push({
    component: ctx.componentFilePath,
    kind,
    name,
    message,
    ...(source ? { source } : {}),
  });
}
