import * as fs from "fs";
import * as path from "path";
import * as glob from "fast-glob";
import { SvelteEntryPoint } from "./get-svelte-entry";

interface SvelteFile {
  filePath: string;
  moduleName: string;
}

/**
 * Get an array of Svelte files for a specified entrypoint
 */
export function getSvelteFiles(entry: SvelteEntryPoint): SvelteFile[] {
  const dir = fs.lstatSync(entry).isFile() ? path.dirname(entry) : entry;

  return glob.sync([`${dir}/**/*.svelte`]).map((filePath) => {
    const { name } = path.parse(filePath);

    return {
      filePath,

      // TODO: [refactor] normalize Svelte component name to follow Pascal case capitalization
      moduleName: name,
    };
  });
}
