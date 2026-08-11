import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { PendingCallDefaultCandidate } from "./ComponentParser";
import { collectModuleExports, type ResolveContext, resolveModuleFile } from "./parse-entry-exports";

export type CallDefaultFailureReason = "module-not-found" | "export-not-found" | "return-type-unresolved";

export interface CallDefaultResolution {
  candidate: PendingCallDefaultCandidate;
  /** Present on success. */
  type?: string;
  /** Present on failure. */
  failureReason?: CallDefaultFailureReason;
}

/** Shared cache/cycle set for one `generateBundle()` run. */
export function createCallDefaultResolveContext(): ResolveContext {
  return { cache: new Map(), computing: new Set() };
}

const FILE_EXTENSION_REGEX = /\.[^./\\]+$/;

/** Sibling `foo.d.ts` for `foo.js` when it exists. */
function siblingDeclarationFile(resolvedFile: string): string | null {
  if (resolvedFile.endsWith(".d.ts")) return null;
  const dtsPath = resolvedFile.replace(FILE_EXTENSION_REGEX, ".d.ts");
  return existsSync(dtsPath) ? dtsPath : null;
}

/**
 * Read each candidate's callee return type from its declaring module
 * ({@link collectModuleExports} follows re-exports). If the `.js` has no
 * `@returns`, try a sibling `.d.ts`. AST/JSDoc only. Not inlined in
 * `ComponentParser` because the browser build cannot use `node:fs`.
 */
export function resolveCallDefaultCandidates(
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

    const resolvedFile = resolveModuleFile(candidate.importSource, fromDir);
    if (!resolvedFile) return { candidate, failureReason: "module-not-found" };

    const match = collectModuleExports(resolvedFile, ctx).find((entry) => entry.name === candidate.importedName);
    if (!match) return { candidate, failureReason: "export-not-found" };
    if (match.returnType) return { candidate, type: match.returnType };

    const siblingDts = siblingDeclarationFile(resolvedFile);
    if (siblingDts) {
      const dtsMatch = collectModuleExports(siblingDts, ctx).find((entry) => entry.name === candidate.importedName);
      if (dtsMatch?.returnType) return { candidate, type: dtsMatch.returnType };
    }

    return { candidate, failureReason: "return-type-unresolved" };
  });
}

/** Message for a candidate that stayed unresolved after the cross-file pass. */
export function describeCallDefaultFailure(
  candidate: PendingCallDefaultCandidate,
  reason: CallDefaultFailureReason,
): string {
  switch (reason) {
    case "module-not-found":
      return `Prop "${candidate.propName}" default calls "${candidate.calleeName}()", but "${candidate.importSource}" could not be resolved; falling back to "any".`;
    case "export-not-found":
      return `Prop "${candidate.propName}" default calls "${candidate.calleeName}()", but "${candidate.importedName}" is not exported from "${candidate.importSource}"; falling back to "any".`;
    case "return-type-unresolved":
      return `Prop "${candidate.propName}" default calls "${candidate.calleeName}()" imported from "${candidate.importSource}", but its return type could not be resolved; falling back to "any".`;
  }
}
