import { dirname, resolve } from "node:path";
import type { ComponentDocApi, ComponentDocs, ResolveComponentFilePath } from "./bundle";

const SVELTE_EXT_REGEX = /\.svelte$/;

/** Strips matching surrounding single/double quotes from an import specifier. */
const SURROUNDING_QUOTES_REGEX = /^(['"])(.*)\1$/;

/**
 * Resolves a component's `@extendProps` / `@extends` target to an absolute path,
 * or `null` when it doesn't point at a local `.svelte` file (e.g. it references
 * an external package interface like `carbon-components-svelte`).
 */
export function resolveExtendsDependency(api: ComponentDocApi, componentPath: string): string | null {
  const raw = api.extends?.import;
  if (raw === undefined) return null;
  // `extends.import` is stored verbatim from the JSDoc tag, including any
  // surrounding quotes (e.g. `"./Button.svelte"`).
  const target = raw.replace(SURROUNDING_QUOTES_REGEX, "$2");
  if (!SVELTE_EXT_REGEX.test(target)) return null;
  return resolve(dirname(componentPath), target);
}

/**
 * Builds a reverse-dependency map: `dependencyPath -> set of dependent paths`.
 *
 * A component is a dependent of `X` when it extends `X` via `@extendProps` /
 * `@extends`. When `X` changes, every dependent must be re-parsed.
 */
export function buildReverseDeps(
  components: ComponentDocs,
  resolveComponentFilePath: ResolveComponentFilePath,
): Map<string, Set<string>> {
  const reverse = new Map<string, Set<string>>();

  for (const api of components.values()) {
    const componentPath = resolveComponentFilePath(api.filePath);
    const dependency = resolveExtendsDependency(api, componentPath);
    if (dependency === null) continue;

    let dependents = reverse.get(dependency);
    if (dependents === undefined) {
      dependents = new Set();
      reverse.set(dependency, dependents);
    }
    dependents.add(componentPath);
  }

  return reverse;
}

/**
 * Expands the set of changed paths to include every transitive dependent via
 * the reverse-dependency map (e.g. editing `Button.svelte` also marks the
 * `SecondaryButton.svelte` that `@extendProps`-es it).
 */
export function expandAffected(changed: Iterable<string>, reverseDeps: Map<string, Set<string>>): Set<string> {
  const affected = new Set<string>();
  const queue: string[] = [];

  for (const path of changed) {
    if (!affected.has(path)) {
      affected.add(path);
      queue.push(path);
    }
  }

  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: queue is non-empty in the loop condition
    const current = queue.shift()!;
    const dependents = reverseDeps.get(current);
    if (dependents === undefined) continue;
    for (const dependent of dependents) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return affected;
}
