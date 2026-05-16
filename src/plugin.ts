import { getSvelteEntry } from "./get-svelte-entry";
import { createSveld, type SveldOptions } from "./SveldDocumenter";

export {
  type ComponentDocApi,
  type ComponentDocs,
  type GenerateBundleResult,
  generateBundle,
  writeOutput,
} from "./SveldDocumenter";

export interface PluginSveldOptions extends Omit<SveldOptions, "input"> {}

interface SveldPlugin {
  name: string;
  apply?: "build" | "serve";
  enforce?: "pre" | "post";
  buildStart(): void;
  generateBundle(): Promise<void>;
  writeBundle(): Promise<void>;
}

export default function pluginSveld(opts?: PluginSveldOptions): SveldPlugin {
  const documenter = createSveld();
  let input: string | null;

  return {
    name: "vite-plugin-sveld",
    apply: "build",
    enforce: "post",
    buildStart() {
      input = getSvelteEntry(opts?.entry);
    },
    async generateBundle() {
      // Generation is handled in writeBundle so output completion can be awaited
      // through one deep module interface.
    },
    async writeBundle() {
      if (input != null) {
        await documenter.write({
          ...opts,
          entry: input,
        });
      }
    },
  };
}
