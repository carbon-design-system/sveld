import { dirname } from "node:path";
import type { ComponentDocApi } from "./bundle";
import { type CrossFilePass, dropUnknownTypeDiagnostic, findCandidateProp, setResolvedField } from "./cross-file-pass";
import type { PendingConstDefaultCandidate } from "./model";
import { findImportedExport, type InternalExport, type PrimitiveLiteral, type ResolveContext } from "./module-exports";

interface ConstDefaultResolution {
  candidate: PendingConstDefaultCandidate;
  /** Present on success. */
  literal?: PrimitiveLiteral;
  /** The const's own type annotation or JSDoc `@type`, when it can be copied into another file. */
  declaredType?: InternalExport["declaredType"];
}

/** Only `export const` with a primitive literal counts; `let`/`var` exports are live bindings. */
function resolveConstDefaultCandidates(
  componentFilePath: string,
  candidates: PendingConstDefaultCandidate[],
  ctx: ResolveContext,
): ConstDefaultResolution[] {
  const fromDir = dirname(componentFilePath);

  return candidates.map((candidate): ConstDefaultResolution => {
    const resolvedFile = ctx.graph.resolve(candidate.importSource, fromDir);
    if (!resolvedFile) return { candidate };

    const match = findImportedExport(resolvedFile, candidate, ctx);
    if (!match?.primitiveLiteral) return { candidate };

    return { candidate, literal: match.primitiveLiteral, declaredType: match.declaredType };
  });
}

/**
 * Swaps the imported identifier for its literal, as for a same-file `const`,
 * and types the prop from the const's declared type, else the literal, only
 * when nothing more explicit won.
 */
function applyConstDefaultResolutions(component: ComponentDocApi, resolutions: ConstDefaultResolution[]): void {
  for (const { candidate, literal, declaredType } of resolutions) {
    if (!literal) continue;
    const prop = findCandidateProp(component, candidate);
    if (!prop) continue;

    setResolvedField(prop, "value", literal.raw);
    setResolvedField(prop, "defaultValue", { raw: literal.raw, kind: "literal", value: literal.value });
    if (prop.typeSource !== "unknown") continue;

    setResolvedField(prop, "type", declaredType?.type ?? literal.type);
    setResolvedField(prop, "typeSource", declaredType?.source ?? "default");
    dropUnknownTypeDiagnostic(component, candidate);
  }
}

/** Writes an imported `export const` literal in as a prop's default. */
export const constDefaultsPass: CrossFilePass<PendingConstDefaultCandidate, ConstDefaultResolution> = {
  collect: (pending) => pending.pendingConstDefaultCandidates ?? [],
  resolve: resolveConstDefaultCandidates,
  apply: applyConstDefaultResolutions,
};
