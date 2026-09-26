import { dirname } from "node:path";
import type { ComponentDocApi } from "./bundle";
import type { PendingContextKeyCandidate, SourceRange } from "./ComponentParser";
import type { CrossFilePass } from "./cross-file-pass";
import { createDiagnostic } from "./diagnostics";
import { findImportedExport, type ResolveContext } from "./module-exports";
import { generateContextTypeName } from "./parser/context-type-name";
import { importPath } from "./parser/value-imports";

export interface ContextKeyResolution {
  candidate: PendingContextKeyCandidate;
  /** Present on success. */
  key?: string;
}

/**
 * Read each candidate's imported key from its declaring module
 * ({@link findImportedExport} follows re-exports and namespace exports).
 * Only `export const` with a string literal or static template counts.
 * `export let` / `var` stay unresolved even if the initializer is a literal.
 * AST only, no `tsc`.
 */
export function resolveContextKeyCandidates(
  componentFilePath: string,
  candidates: PendingContextKeyCandidate[],
  ctx: ResolveContext,
): ContextKeyResolution[] {
  const fromDir = dirname(componentFilePath);

  return candidates.map((candidate): ContextKeyResolution => {
    const resolvedFile = ctx.graph.resolve(candidate.importSource, fromDir);
    if (!resolvedFile) return { candidate };

    const match = findImportedExport(resolvedFile, candidate, ctx);
    if (match?.kind !== "const" || match.literalValue === undefined) return { candidate };

    return { candidate, key: match.literalValue };
  });
}

/**
 * Append each resolved context to `component.contexts`. Unresolved keys and
 * duplicate keys get the same diagnostics `parseSetContextCall` records for
 * a local call, and the first call in source order keeps its shape.
 */
function applyContextKeyResolutions(component: ComponentDocApi, resolutions: ContextKeyResolution[]): void {
  for (const { candidate, key } of resolutions) {
    if (!key) {
      const label = importPath(candidate);
      component.diagnostics = [
        ...(component.diagnostics ?? []),
        createDiagnostic({
          component: component.filePath,
          kind: "context-key-unresolved",
          name: label,
          message: `setContext key \`${label}\` from "${candidate.importSource}" isn't an \`export const\` string or Symbol() sveld can read; the context is skipped.`,
          ...(candidate.source ? { source: candidate.source } : {}),
        }),
      ];
      continue;
    }

    const contexts = [...(component.contexts ?? [])];
    const duplicateIndex = contexts.findIndex((existing) => existing.key === key);
    if (duplicateIndex !== -1) {
      // Same rule as a same-file duplicate: the first call's shape wins and the later call is flagged.
      const duplicate = contexts[duplicateIndex];
      const candidateIsFirst = startsAfter(duplicate.source, candidate.source);
      const laterSource = candidateIsFirst ? duplicate.source : candidate.source;
      component.diagnostics = [
        ...(component.diagnostics ?? []),
        createDiagnostic({
          component: component.filePath,
          kind: "context-duplicate-key",
          name: key,
          message: `setContext("${key}", ...) was called more than once; only the first call's shape is used.`,
          ...(laterSource ? { source: laterSource } : {}),
        }),
      ];
      if (!candidateIsFirst) continue;
      contexts.splice(duplicateIndex, 1);
    }

    // Keep source order, as a same-file key would: go before the first later `setContext`.
    const laterIndex = contexts.findIndex((existing) => startsAfter(existing.source, candidate.source));
    contexts.splice(laterIndex === -1 ? contexts.length : laterIndex, 0, {
      key,
      typeName: generateContextTypeName(key),
      ...(candidate.type === undefined ? {} : { type: candidate.type }),
      description: candidate.description,
      properties: candidate.properties,
      ...(candidate.hasUnresolvedSpread ? { hasUnresolvedSpread: true } : {}),
      ...(candidate.internal ? { internal: true } : {}),
      source: candidate.source,
    });
    component.contexts = contexts;
  }
}

function startsAfter(range: SourceRange | undefined, other: SourceRange | undefined): boolean {
  if (!range || !other) return false;
  const { line, column } = range.start;
  return line > other.start.line || (line === other.start.line && column > other.start.column);
}

/** Adds a context whose `setContext` key is imported. */
export const contextKeysPass: CrossFilePass<PendingContextKeyCandidate, ContextKeyResolution> = {
  collect: (pending) => pending.pendingContextKeyCandidates ?? [],
  resolve: resolveContextKeyCandidates,
  apply: applyContextKeyResolutions,
};
