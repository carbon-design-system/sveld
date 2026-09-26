import type { ComponentDocApi, ResolveComponentFilePath } from "./bundle";
import type { PendingCrossFileCandidates } from "./ComponentParser";
import type { CrossFilePass } from "./cross-file-pass";
import { createResolveContext, type ResolveContext } from "./parse-entry-exports";
import { loadParserStack } from "./parser-stack";
import { callDefaultsPass } from "./resolve-call-defaults";
import { constDefaultsPass } from "./resolve-const-defaults";
import { contextKeysPass } from "./resolve-context-keys";
import { dispatchEscapesPass } from "./resolve-dispatch-escapes";

/** A pass bound to one component's candidates, run once they're known to be non-empty. */
type BoundPass = (component: ComponentDocApi, componentFilePath: string, ctx: ResolveContext) => void;

function bind<Candidate, Resolution>(
  pass: CrossFilePass<Candidate, Resolution>,
): (pending: PendingCrossFileCandidates) => BoundPass | undefined {
  return (pending) => {
    const candidates = pass.collect(pending);
    if (candidates.length === 0) return undefined;
    return (component, componentFilePath, ctx) =>
      pass.apply(component, pass.resolve(componentFilePath, candidates, ctx), pending);
  };
}

/** In the order they run: each sees the component as the previous one left it. */
const PASSES = [bind(callDefaultsPass), bind(constDefaultsPass), bind(contextKeysPass), bind(dispatchEscapesPass)];

/**
 * Resolves each component's cross-file candidates in place: prop defaults
 * that call or name an import, `setContext` keys bound to an import, and
 * events dispatched by an imported helper. AST/JSDoc only (no tsc).
 *
 * Each component gets its own resolve context, so its result doesn't depend
 * on which components ran first, and the files that context read are the
 * component's cross-file dependencies. Returns them keyed by `filePath`,
 * for every component that had something to resolve.
 */
export async function resolveCrossFileCandidates(
  scope: Iterable<ComponentDocApi>,
  resolveComponentFilePath: ResolveComponentFilePath,
  pendingFor: (component: ComponentDocApi) => PendingCrossFileCandidates | undefined,
): Promise<Map<string, string[]>> {
  const work: Array<{ component: ComponentDocApi; passes: BoundPass[] }> = [];
  for (const component of scope) {
    const pending = pendingFor(component);
    if (pending === undefined) continue;
    const passes = PASSES.flatMap((pass) => pass(pending) ?? []);
    if (passes.length > 0) work.push({ component, passes });
  }

  const readsByFilePath = new Map<string, string[]>();
  if (work.length === 0) return readsByFilePath;

  // Warm-cache runs skip the parser stack, but sibling modules still need it.
  await loadParserStack();

  // Per-component contexts keep each result independent of order; the
  // modules they parse are shared.
  const modules: ResolveContext["modules"] = new Map();

  for (const { component, passes } of work) {
    const ctx = createResolveContext(modules);
    const filePath = resolveComponentFilePath(component.filePath);
    for (const pass of passes) pass(component, filePath, ctx);
    readsByFilePath.set(component.filePath, Array.from(ctx.cache.keys()));
  }

  return readsByFilePath;
}
