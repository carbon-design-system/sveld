import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { PendingCallDefaultCandidate } from "./ComponentParser";
import { collectModuleExports, type ResolveContext, resolveModuleFile } from "./parse-entry-exports";

/** Why a cross-file call-default candidate's return type couldn't be resolved. */
export type CallDefaultFailureReason = "module-not-found" | "export-not-found" | "return-type-unresolved";

export interface CallDefaultResolution {
  candidate: PendingCallDefaultCandidate;
  /** Resolved return type text, present only on success. */
  type?: string;
  /** Present only on failure. */
  failureReason?: CallDefaultFailureReason;
}

/** Fresh, run-scoped cache/cycle-guard for {@link resolveCallDefaultCandidates}. Share one across a whole `generateBundle()` run. */
export function createCallDefaultResolveContext(): ResolveContext {
  return { cache: new Map(), computing: new Set() };
}

const FILE_EXTENSION_REGEX = /\.[^./\\]+$/;

/** `foo.js` -> `foo.d.ts` in the same directory, when it exists. `null` for a `.d.ts` file itself or a missing sibling. */
function siblingDeclarationFile(resolvedFile: string): string | null {
  if (resolvedFile.endsWith(".d.ts")) return null;
  const dtsPath = resolvedFile.replace(FILE_EXTENSION_REGEX, ".d.ts");
  return existsSync(dtsPath) ? dtsPath : null;
}

/**
 * Resolves each candidate's callee return type by reading its declaring
 * module (following re-exports - {@link collectModuleExports} already does
 * this) and, when the module itself carries no type info (a plain `.js` file
 * with no JSDoc `@returns`), falling back to a sibling `.d.ts`.
 *
 * AST/JSDoc-text only, no `tsc` - see `PendingCallDefaultCandidate` for why
 * this can't run inline during `ComponentParser` parsing (browser-safe code
 * can't touch `node:fs`).
 */
export function resolveCallDefaultCandidates(
  componentFilePath: string,
  candidates: PendingCallDefaultCandidate[],
  ctx: ResolveContext,
): CallDefaultResolution[] {
  const fromDir = dirname(componentFilePath);

  return candidates.map((candidate): CallDefaultResolution => {
    if (!candidate.importSource || !candidate.importedName) {
      // No import lead (same-file function with no derivable return type, or an unknown
      // callee) - already finalized to "any" with a diagnostic during parsing.
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

/** Diagnostic text for a candidate that stayed unresolved after the cross-file pass. */
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
