import { createDiagnostic, DIAGNOSTIC_CODES, type SveldDiagnosticKind } from "../diagnostics";
import type { SourceRange } from "../model";
import type { ParserContext } from "./context";

/** Records a diagnostic, marked `ignored` when {@link recordSveldIgnore} saw a matching `@sveld-ignore`. */
export function recordDiagnostic(
  ctx: ParserContext,
  kind: SveldDiagnosticKind,
  name: string,
  message: string,
  source?: SourceRange,
) {
  ctx.diagnosticRecords.push(buildDiagnostic(ctx, kind, name, message, source));
}

/** The diagnostic {@link recordDiagnostic} would record, for callers that hold it back. */
export function buildDiagnostic(
  ctx: ParserContext,
  kind: SveldDiagnosticKind,
  name: string,
  message: string,
  source?: SourceRange,
) {
  return createDiagnostic({
    component: ctx.componentFilePath,
    kind,
    name,
    message,
    ...(source ? { source } : {}),
    ...(isSveldIgnored(ctx, kind, name) ? { ignored: true } : {}),
  });
}

/** Keyed by kind too, so a context variable and a prop can't collide. */
function ignoreKey(kind: SveldDiagnosticKind, name: string): string {
  return `${kind}:${name}`;
}

/**
 * Registers a symbol's `@sveld-ignore <code>` codes (`""` for a bare one:
 * ignore everything). Must run before {@link recordDiagnostic} for the same
 * `kind`/`name`.
 */
export function recordSveldIgnore(
  ctx: ParserContext,
  kind: SveldDiagnosticKind,
  name: string,
  codes: string[] | undefined,
) {
  if (!codes || codes.length === 0) return;
  const key = ignoreKey(kind, name);
  const existing = ctx.sveldIgnoreDirectives.get(key) ?? new Set<string>();
  for (const code of codes) existing.add(code);
  ctx.sveldIgnoreDirectives.set(key, existing);
}

export function isSveldIgnored(ctx: ParserContext, kind: SveldDiagnosticKind, name: string): boolean {
  const codes = ctx.sveldIgnoreDirectives.get(ignoreKey(kind, name));
  if (!codes) return false;
  return codes.has("") || codes.has(DIAGNOSTIC_CODES[kind]);
}
