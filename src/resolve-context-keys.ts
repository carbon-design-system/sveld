import { dirname } from "node:path";
import type { PendingContextKeyCandidate } from "./ComponentParser";
import { findModuleExportPath, type ResolveContext, resolveModuleFile } from "./parse-entry-exports";

export interface ContextKeyResolution {
  candidate: PendingContextKeyCandidate;
  /** Present on success. */
  key?: string;
}

/**
 * Read each candidate's imported key from its declaring module
 * ({@link findModuleExportPath} follows re-exports and namespace exports).
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
    const resolvedFile = resolveModuleFile(candidate.importSource, fromDir);
    if (!resolvedFile) return { candidate };

    const names = [candidate.importedName, ...(candidate.members ?? [])];
    const match = findModuleExportPath(resolvedFile, names, ctx);
    if (match?.kind !== "const" || match.literalValue === undefined) return { candidate };

    return { candidate, key: match.literalValue };
  });
}
