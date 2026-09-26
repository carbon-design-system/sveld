/**
 * One kind of value a component reads from another file: a prop default
 * that names or calls an import, an imported `setContext` key, or the
 * events an imported helper dispatches. The parse leaves candidates for
 * each (see `PendingCrossFileCandidates`); `resolveCrossFileCandidates`
 * runs every pass over them once all components have parsed.
 */
import type { ComponentDocApi } from "./bundle";
import type { ComponentProp, PendingConstDefaultCandidate, PendingCrossFileCandidates } from "./ComponentParser";
import type { ResolveContext } from "./parse-entry-exports";

export interface CrossFilePass<Candidate, Resolution> {
  /** This pass's candidates out of what the parse left pending. */
  collect(pending: PendingCrossFileCandidates): Candidate[];
  /** Reads the other files. AST/JSDoc only (no tsc). */
  resolve(componentFilePath: string, candidates: Candidate[], ctx: ResolveContext): Resolution[];
  /** Writes the resolutions onto the component, in place. */
  apply(component: ComponentDocApi, resolutions: Resolution[], pending: PendingCrossFileCandidates): void;
}

/**
 * Sets a field a cross-file pass resolved. A fresh parse can hold the field
 * as `undefined` where one read back from the cache file has no key, so an
 * undefined field is re-added last, as it would be when missing, and the
 * output's key order doesn't depend on cache state.
 */
export function setResolvedField<K extends keyof ComponentProp>(
  prop: ComponentProp,
  key: K,
  value: ComponentProp[K],
): void {
  if (prop[key] === undefined) delete prop[key];
  prop[key] = value;
}

type PropDefaultCandidate = Pick<PendingConstDefaultCandidate, "propName" | "location">;

export function findCandidateProp(component: ComponentDocApi, candidate: PropDefaultCandidate) {
  const list = candidate.location === "props" ? component.props : component.moduleExports;
  return list.find((entry) => entry.name === candidate.propName);
}

/** The parse-time `prop-unknown-type` no longer applies once the default's type is known. */
export function dropUnknownTypeDiagnostic(component: ComponentDocApi, candidate: PropDefaultCandidate): void {
  if (candidate.location !== "props") return;
  component.diagnostics = (component.diagnostics ?? []).filter(
    (diagnostic) => !(diagnostic.kind === "prop-unknown-type" && diagnostic.name === candidate.propName),
  );
}
