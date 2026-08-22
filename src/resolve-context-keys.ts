import { dirname } from "node:path";
import type { PendingContextKeyCandidate } from "./ComponentParser";
import { collectModuleExports, type ResolveContext, resolveModuleFile } from "./parse-entry-exports";

export interface ContextKeyResolution {
  candidate: PendingContextKeyCandidate;
  /** Present on success. */
  key?: string;
}

/**
 * Read each candidate's imported key from its declaring module
 * ({@link collectModuleExports} follows re-exports). Only `export const`
 * with a string literal or static template counts. `export let` / `var`
 * stay unresolved even if the initializer is a literal. AST only, no `tsc`.
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

    const match = collectModuleExports(resolvedFile, ctx).find((entry) => entry.name === candidate.importedName);
    if (match?.kind !== "const" || match.literalValue === undefined) return { candidate };

    return { candidate, key: match.literalValue };
  });
}
