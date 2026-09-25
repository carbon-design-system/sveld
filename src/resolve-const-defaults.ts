import { dirname } from "node:path";
import type { PendingConstDefaultCandidate } from "./ComponentParser";
import {
  findImportedExport,
  type InternalExport,
  type PrimitiveLiteral,
  type ResolveContext,
  resolveModuleFile,
} from "./parse-entry-exports";

export interface ConstDefaultResolution {
  candidate: PendingConstDefaultCandidate;
  /** Present on success. */
  literal?: PrimitiveLiteral;
  /** The const's own type annotation or JSDoc `@type`, when it can be copied into another file. */
  declaredType?: InternalExport["declaredType"];
}

/**
 * Read each candidate's imported value from its declaring module
 * ({@link findImportedExport} follows re-exports and namespace exports).
 * Only `export const` with a primitive literal counts; `let`/`var` exports
 * are live bindings. AST only, no `tsc`.
 */
export function resolveConstDefaultCandidates(
  componentFilePath: string,
  candidates: PendingConstDefaultCandidate[],
  ctx: ResolveContext,
): ConstDefaultResolution[] {
  const fromDir = dirname(componentFilePath);

  return candidates.map((candidate): ConstDefaultResolution => {
    const resolvedFile = resolveModuleFile(candidate.importSource, fromDir);
    if (!resolvedFile) return { candidate };

    const match = findImportedExport(resolvedFile, candidate, ctx);
    if (!match?.primitiveLiteral) return { candidate };

    return { candidate, literal: match.primitiveLiteral, declaredType: match.declaredType };
  });
}
