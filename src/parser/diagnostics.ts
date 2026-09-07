import type { SourceRange } from "../ComponentParser";
import { createDiagnostic, DIAGNOSTIC_CODES, type SveldDiagnosticKind } from "../diagnostics";
import type { ParserContext } from "./context";

/**
 * Appends a diagnostic (a place sveld had to guess a type) to `ctx.diagnosticRecords`,
 * tagged with the file path of the component currently being parsed. Marked
 * `ignored` automatically when an inline `@sveld-ignore` tag targeting this
 * diagnostic's code was recorded earlier in the parse via {@link recordSveldIgnore}.
 */
export function recordDiagnostic(
  ctx: ParserContext,
  kind: SveldDiagnosticKind,
  name: string,
  message: string,
  source?: SourceRange,
) {
  ctx.diagnosticRecords.push(
    createDiagnostic({
      component: ctx.componentFilePath,
      kind,
      name,
      message,
      ...(source ? { source } : {}),
      ...(isSveldIgnored(ctx, kind, name) ? { ignored: true } : {}),
    }),
  );
}

/** Key `ctx.sveldIgnoreDirectives` by kind + name so a context variable and a prop can't collide. */
function ignoreKey(kind: SveldDiagnosticKind, name: string): string {
  return `${kind}:${name}`;
}

/**
 * Registers one or more `@sveld-ignore <code>` codes (or `""` for a bare
 * `@sveld-ignore`, meaning "ignore anything for this symbol") found on the
 * JSDoc comment attached to a prop, `@event` tag, or context variable.
 * Must run before {@link recordDiagnostic} is called for the same
 * `kind`/`name` pair; every call site that can produce a diagnostic runs its
 * JSDoc-collection pass before the finalize pass that calls `recordDiagnostic`.
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

/** True when `recordSveldIgnore` recorded a matching code (or a bare ignore-all) for this symbol. */
function isSveldIgnored(ctx: ParserContext, kind: SveldDiagnosticKind, name: string): boolean {
  const codes = ctx.sveldIgnoreDirectives.get(ignoreKey(kind, name));
  if (!codes) return false;
  return codes.has("") || codes.has(DIAGNOSTIC_CODES[kind]);
}
