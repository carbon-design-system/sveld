import { dirname } from "node:path";
import type { ComponentDocApi } from "./bundle";
import type { PendingConstDefaultCandidate } from "./ComponentParser";
import { type CrossFilePass, dropUnknownTypeDiagnostic, findCandidateProp, setResolvedField } from "./cross-file-pass";
import { findImportedExport, type InternalExport, type PrimitiveLiteral, type ResolveContext } from "./module-exports";

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
    const resolvedFile = ctx.graph.resolve(candidate.importSource, fromDir);
    if (!resolvedFile) return { candidate };

    const match = findImportedExport(resolvedFile, candidate, ctx);
    if (!match?.primitiveLiteral) return { candidate };

    return { candidate, literal: match.primitiveLiteral, declaredType: match.declaredType };
  });
}

/**
 * Swap the imported identifier for its literal in `value`/`defaultValue`,
 * matching a same-file `const`. Type the prop from the const's declared
 * type, else the literal, only when nothing more explicit won, and drop the
 * parse-time `prop-unknown-type`.
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
