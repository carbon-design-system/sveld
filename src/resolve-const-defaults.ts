import { dirname } from "node:path";
import type { PendingConstDefaultCandidate } from "./ComponentParser";
import {
  collectModuleExports,
  findModuleExport,
  type PrimitiveLiteral,
  type ResolveContext,
  resolveModuleFile,
} from "./parse-entry-exports";

export interface ConstDefaultResolution {
  candidate: PendingConstDefaultCandidate;
  /** Present on success. */
  literal?: PrimitiveLiteral;
}

/**
 * Read each candidate's imported value from its declaring module
 * ({@link collectModuleExports} follows re-exports). Only `export const`
 * with a primitive literal counts; `let`/`var` exports are live bindings.
 * AST only, no `tsc`.
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

    const match = findModuleExport(collectModuleExports(resolvedFile, ctx), candidate.importedName);
    if (!match?.primitiveLiteral) return { candidate };

    return { candidate, literal: match.primitiveLiteral };
  });
}
