import type { GenerateBundleOptions, GenerateBundleResult } from "./bundle";
import { Project, type ProjectUpdate } from "./project";

/**
 * A long-lived bundle that supports scoped, incremental re-parsing.
 *
 * `createSveldBundle` performs the initial full parse. `update` then re-parses
 * only the components affected by a set of changed files, leaving every other
 * component's previously-parsed output untouched. This is the core of the
 * plugin's watch mode.
 */
export interface SveldBundle {
  /** The latest result: the initial build's, then each update's. */
  readonly result: Promise<GenerateBundleResult>;
  /** Re-parse the changed files and the components that read them, and return the updated bundle. */
  update(changedFilePaths: string[]): Promise<ProjectUpdate>;
}

/**
 * Creates a watch-mode bundle for the given entry point, performing the initial
 * full parse up front. Takes the same options as `generateBundle`, except
 * `failFast`: a component that fails to parse is reported and skipped, so
 * fixing it in a later edit picks it back up.
 *
 * @param input - Entry point file or directory containing Svelte components
 * @param glob - Whether to glob for all `.svelte` files in the directory
 */
export async function createSveldBundle(
  input: string,
  glob: boolean,
  options: Omit<GenerateBundleOptions, "failFast"> = {},
): Promise<SveldBundle> {
  const project = new Project(input, glob, { ...options, failFast: false });
  let latest = await project.build();

  return {
    get result() {
      return Promise.resolve(latest);
    },
    async update(changedFilePaths) {
      const updated = await project.update(changedFilePaths);
      latest = updated.result;
      return updated;
    },
  };
}
