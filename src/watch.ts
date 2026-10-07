import type { GenerateBundleOptions, GenerateBundleResult } from "./bundle";
import { Project, type ProjectUpdate } from "./project";

/** The plugin's watch-mode bundle: `update` re-parses only the components a change affects. */
export interface SveldBundle {
  /** The latest result: the initial build's, then each update's. */
  readonly result: Promise<GenerateBundleResult>;
  /** Re-parse the changed files and the components that read them, and return the updated bundle. */
  update(changedFilePaths: string[]): Promise<ProjectUpdate>;
}

/**
 * Runs the initial full parse. Never `failFast`: a component that fails to
 * parse is reported and skipped, so fixing it in a later edit picks it back up.
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
