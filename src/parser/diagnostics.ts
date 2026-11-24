import { createDiagnostic, DIAGNOSTIC_CODES, type SveldDiagnosticKind } from "../diagnostics";
import type { SourceRange } from "../model";
import type { ParserContext } from "./context";

export function recordDiagnostic(
  ctx: ParserContext,
  kind: SveldDiagnosticKind,
  name: string,
  message: string,
  source?: SourceRange,
) {
  ctx.diagnosticRecords.push(buildDiagnostic(ctx, kind, name, message, source));
}

// Builds without recording, for callers that hold a diagnostic back.
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

// Keyed by kind too, so a context variable and a prop can't collide.
function ignoreKey(kind: SveldDiagnosticKind, name: string): string {
  return `${kind}:${name}`;
}

// Must run before `recordDiagnostic` for the same `kind`/`name`. A bare
// `@sveld-ignore` records `""`, which ignores everything.
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

// Also kept for diagnostics reported after parsing, not only for
// `recordSveldIgnore` to read.
export function recordPropSveldIgnore(ctx: ParserContext, propName: string, codes: string[] | undefined) {
  recordSveldIgnore(ctx, "prop-unknown-type", propName, codes);
  recordSveldIgnore(ctx, "bind-this-type-mismatch", propName, codes);
  if (codes && codes.length > 0) ctx.propIgnoreCodes.set(propName, codes);
}

export function isSveldIgnored(ctx: ParserContext, kind: SveldDiagnosticKind, name: string): boolean {
  const codes = ctx.sveldIgnoreDirectives.get(ignoreKey(kind, name));
  if (!codes) return false;
  return codes.has("") || codes.has(DIAGNOSTIC_CODES[kind]);
}
