import { dirname, resolve } from "node:path";
import type { ComponentDocApi, ComponentDocs, ResolveComponentFilePath } from "./bundle";

/** Strips matching surrounding single/double quotes from an import specifier. */
const SURROUNDING_QUOTES_REGEX = /^(['"])(.*)\1$/;

/** Matches a relative or absolute path specifier, as opposed to a bare package import. */
const LOCAL_SPECIFIER_REGEX = /^[./]/;

/** Matches a JSDoc/TS `import("./x")` type reference; captures the specifier. */
const TYPE_IMPORT_REGEX = /import\(\s*(['"])((?:(?!\1).)+)\1\s*\)/g;

/**
 * Resolves a component's `@extendProps` / `@extends` target to an absolute path,
 * or `null` when it isn't a local path (e.g. it references an external
 * package interface like `carbon-components-svelte`). The target need not be
 * `.svelte`: `@extendProps {./types.ts}` names a `.ts` interface.
 */
function resolveExtendsDependency(api: ComponentDocApi, componentPath: string): string | null {
  const raw = api.extends?.import;
  if (raw === undefined) return null;
  // `extends.import` is stored verbatim from the JSDoc tag, including any
  // surrounding quotes (e.g. `"./Button.svelte"`).
  const target = raw.replace(SURROUNDING_QUOTES_REGEX, "$2");
  if (!LOCAL_SPECIFIER_REGEX.test(target)) return null;
  return resolve(dirname(componentPath), target);
}

/** Extracts every local `import("./x")` type-reference target from a type text, resolved to an absolute path. */
function resolveTypeImportDependencies(typeText: string, componentPath: string): string[] {
  const targets: string[] = [];
  for (const match of typeText.matchAll(TYPE_IMPORT_REGEX)) {
    const specifier = match[2];
    if (!LOCAL_SPECIFIER_REGEX.test(specifier)) continue;
    targets.push(resolve(dirname(componentPath), specifier));
  }
  return targets;
}

/**
 * Resolves every local file a component depends on for its documented shape:
 * its `@extendProps` / `@extends` target, plus any `import("./x")` type
 * reference inside its own `@typedef`s or prop types. Changing any of these
 * files must re-parse the component even though they're never `.svelte`
 * themselves and so are never components in their own right.
 */
function resolveDependencies(api: ComponentDocApi, componentPath: string): string[] {
  const dependencies: string[] = [];

  const extendsDependency = resolveExtendsDependency(api, componentPath);
  if (extendsDependency !== null) dependencies.push(extendsDependency);

  for (const typedef of api.typedefs ?? []) {
    dependencies.push(...resolveTypeImportDependencies(typedef.type, componentPath));
  }
  for (const prop of api.props) {
    if (prop.type) dependencies.push(...resolveTypeImportDependencies(prop.type, componentPath));
  }

  return dependencies;
}

/**
 * Builds a reverse-dependency map: `dependencyPath -> set of dependent paths`.
 *
 * A component is a dependent of `X` when it extends `X` via `@extendProps` /
 * `@extends`, or references it via a `import("./x")` type. When `X` changes,
 * every dependent must be re-parsed.
 */
export function buildReverseDeps(
  components: ComponentDocs,
  resolveComponentFilePath: ResolveComponentFilePath,
): Map<string, Set<string>> {
  const reverse = new Map<string, Set<string>>();

  for (const api of components.values()) {
    const componentPath = resolveComponentFilePath(api.filePath);

    for (const dependency of resolveDependencies(api, componentPath)) {
      let dependents = reverse.get(dependency);
      if (dependents === undefined) {
        dependents = new Set();
        reverse.set(dependency, dependents);
      }
      dependents.add(componentPath);
    }
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
