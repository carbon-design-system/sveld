import * as fs from "fs-extra";
import * as path from "path";
import * as fg from "fast-glob";
import writeTsDefinitions, { WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";
import writeJson, { WriteJsonOptions } from "./writer/writer-json";
import writeMarkdown, { WriteMarkdownOptions } from "./writer/writer-markdown";
import ComponentParser, { ParsedComponent } from "./ComponentParser";
import { getSvelteEntry } from "./get-svelte-entry";
import { ParsedExports, parseExports } from "./parse-exports";
import { preprocess } from "svelte/compiler";
import { replace, typescript } from "svelte-preprocess";
import { normalizeSeparators } from "./path";

export interface PluginSveldOptions {
  glob?: boolean;
  types?: boolean;
  typesOptions?: Partial<Omit<WriteTsDefinitionsOptions, "inputDir">>;
  json?: boolean;
  jsonOptions?: Partial<Omit<WriteJsonOptions, "inputDir">>;
  markdown?: boolean;
  markdownOptions?: Partial<WriteMarkdownOptions>;
}

type ComponentModuleName = string;

export interface ComponentDocApi extends ParsedComponent {
  filePath: string;
  moduleName: string;
}

export type ComponentDocs = Map<ComponentModuleName, ComponentDocApi>;

export default function pluginSveld(opts?: PluginSveldOptions) {
  let result: GenerateBundleResult;
  let input: string | null;

  return {
    name: "plugin-sveld",
    buildStart() {
      input = getSvelteEntry();
    },
    async generateBundle() {
      if (input != null) {
        result = await generateBundle(input, opts?.glob === true);
      }
    },
    writeBundle() {
      if (input != null) writeOutput(result, opts || {}, input);
    },
  };
}

interface GenerateBundleResult {
  exports: ParsedExports;
  components: ComponentDocs;
}

export async function generateBundle(input: string, glob: boolean) {
  const dir = fs.lstatSync(input).isFile() ? path.dirname(input) : input;
  const entry = fs.readFileSync(input, "utf-8");
  const exports = parseExports(entry);

  if (glob) {
    fg.sync([`${dir}/**/*.svelte`]).forEach((file) => {
      const moduleName = path.parse(file).name.replace(/\-/g, "");
      let source = normalizeSeparators("./" + path.relative(dir, file));

      if (exports[moduleName]) {
        exports[moduleName].source = source;
      }
    });
  }

  const components: ComponentDocs = new Map();
  const parser = new ComponentParser();

  for (const [moduleName, entry] of Object.entries(exports)) {
    const filePath = entry.source,
      ext = path.parse(filePath).ext;

    if (ext === ".svelte") {
      const source = await fs.readFile(path.resolve(dir, filePath), "utf-8");

      const { code: processed } = await preprocess(source, [typescript(), replace([[/<style.+<\/style>/gims, ""]])], {
        filename: path.basename(filePath),
      });

      components.set(moduleName, {
        moduleName,
        filePath,
        ...parser.parseSvelteComponent(processed, {
          moduleName,
          filePath,
        }),
      });
    }
  }

  return {
    exports,
    components,
  };
}

export function writeOutput(result: GenerateBundleResult, opts: PluginSveldOptions, input: string) {
  const inputDir = path.dirname(input);

  if (opts?.types !== false) {
    writeTsDefinitions(result.components, {
      outDir: "types",
      preamble: "",
      ...opts?.typesOptions,
      exports: result.exports,
      inputDir,
    });
  }

  if (opts?.json) {
    writeJson(result.components, {
      outFile: "COMPONENT_API.json",
      ...opts?.jsonOptions,
      input,
      inputDir,
    });
  }

  if (opts?.markdown) {
    writeMarkdown(result.components, {
      outFile: "COMPONENT_INDEX.md",
      ...opts?.markdownOptions,
    });
  }
}
