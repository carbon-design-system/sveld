import { dirname } from "node:path";
import type { ComponentDocApi } from "./bundle";
import { type CrossFilePass, dropUnknownTypeDiagnostic, findCandidateProp, setResolvedField } from "./cross-file-pass";
import type { PendingCallDefaultCandidate } from "./model";
import { findModuleExport, type ResolveContext } from "./module-exports";
import type { ModuleGraph } from "./module-graph";

type CallDefaultFailureReason = "module-not-found" | "export-not-found" | "return-type-unresolved";

interface CallDefaultResolution {
  candidate: PendingCallDefaultCandidate;
  /** Present on success. */
  type?: string;
  /** Present on failure. */
  failureReason?: CallDefaultFailureReason;
}

const FILE_EXTENSION_REGEX = /\.[^./\\]+$/;

function siblingDeclarationFile(resolvedFile: string, graph: ModuleGraph): string | null {
  if (resolvedFile.endsWith(".d.ts")) return null;
  const dtsPath = resolvedFile.replace(FILE_EXTENSION_REGEX, ".d.ts");
  return graph.exists(dtsPath) ? dtsPath : null;
}

/**
 * Reads each callee's return type from its declaring module, falling back to
 * a sibling `.d.ts`. Outside `ComponentParser` because the browser build
 * can't use `node:fs`.
 */
function resolveCallDefaultCandidates(
  componentFilePath: string,
  candidates: PendingCallDefaultCandidate[],
  ctx: ResolveContext,
): CallDefaultResolution[] {
  const fromDir = dirname(componentFilePath);

  return candidates.map((candidate): CallDefaultResolution => {
    if (!candidate.importSource || !candidate.importedName) {
      // Parse already finalized these to "any".
      return { candidate };
    }

    const resolvedFile = ctx.graph.resolve(candidate.importSource, fromDir);
    if (!resolvedFile) return { candidate, failureReason: "module-not-found" };

    const match = findModuleExport(resolvedFile, candidate.importedName, ctx);
    if (!match) return { candidate, failureReason: "export-not-found" };
    if (match.returnType) return { candidate, type: match.returnType };

    const siblingDts = siblingDeclarationFile(resolvedFile, ctx.graph);
    if (siblingDts) {
      const dtsMatch = findModuleExport(siblingDts, candidate.importedName, ctx);
      if (dtsMatch?.returnType) return { candidate, type: dtsMatch.returnType };
    }

    return { candidate, failureReason: "return-type-unresolved" };
  });
}

function describeCallDefaultFailure(candidate: PendingCallDefaultCandidate, reason: CallDefaultFailureReason): string {
  switch (reason) {
    case "module-not-found":
      return `Prop "${candidate.propName}" default calls "${candidate.calleeName}()", but "${candidate.importSource}" could not be resolved; falling back to "any".`;
    case "export-not-found":
      return `Prop "${candidate.propName}" default calls "${candidate.calleeName}()", but "${candidate.importedName}" is not exported from "${candidate.importSource}"; falling back to "any".`;
    case "return-type-unresolved":
      return `Prop "${candidate.propName}" default calls "${candidate.calleeName}()" imported from "${candidate.importSource}", but its return type could not be resolved; falling back to "any".`;
  }
}

/** Drops or rewrites the parse-time `prop-unknown-type`. An explicit `@type` keeps winning. */
function applyCallDefaultResolutions(component: ComponentDocApi, resolutions: CallDefaultResolution[]): void {
  for (const { candidate, type, failureReason } of resolutions) {
    const prop = findCandidateProp(component, candidate);
    if (prop?.typeSource !== "unknown") continue;

    if (type) {
      setResolvedField(prop, "type", type);
      setResolvedField(prop, "typeSource", "typescript");
      dropUnknownTypeDiagnostic(component, candidate);
      continue;
    }

    if (candidate.location === "props" && failureReason) {
      const existing = component.diagnostics?.find(
        (diagnostic) => diagnostic.kind === "prop-unknown-type" && diagnostic.name === candidate.propName,
      );
      if (existing) existing.message = describeCallDefaultFailure(candidate, failureReason);
    }
  }
}

/** Types a prop from the return type of the imported function its default calls. */
export const callDefaultsPass: CrossFilePass<PendingCallDefaultCandidate, CallDefaultResolution> = {
  // A default calling a local function was settled at parse time.
  collect: (pending) =>
    pending.pendingCallDefaultCandidates?.filter((candidate) => candidate.importSource !== undefined) ?? [],
  resolve: resolveCallDefaultCandidates,
  apply: applyCallDefaultResolutions,
};
