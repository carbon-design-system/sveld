import * as fs from "fs-extra";
import * as path from "path";
import writeTsDefinitions, { WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";
import writeJson, { WriteJsonOptions } from "./writer/writer-json";
import writeMarkdown, { WriteMarkdownOptions } from "./writer/writer-markdown";
import ComponentParser, { ParsedComponent } from "./ComponentParser";
import { getSvelteEntry } from "./get-svelte-entry";
import { ParsedExports, parseExports } from "./parse-exports";
import { getSvelteFiles } from "./get-svelte-files";

export interface PluginSveldOptions {
  types?: boolean;
  typesOptions?: WriteTsDefinitionsOptions;
  json?: boolean;
  jsonOptions?: WriteJsonOptions;
  markdown?: boolean;
  markdownOptions?: WriteMarkdownOptions;
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
        result = await generateBundle(input);
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

export async function generateBundle(input: string) {
  const entry = fs.readFileSync(input, "utf-8");
  const exports = parseExports(entry);
  const components: ComponentDocs = new Map();
  const parser = new ComponentParser();

  for (const { filePath, moduleName } of getSvelteFiles(input)) {
    const source = await fs.readFile(filePath, "utf-8");

    components.set(moduleName, {
      moduleName,
      filePath,
      ...parser.parseSvelteComponent(source, {
        moduleName,
        filePath,
      }),
    });
  }

  return {
    exports,
    components,
  };
}

export function writeOutput(result: GenerateBundleResult, opts: PluginSveldOptions, input: string) {
  if (opts?.types !== false) {
    writeTsDefinitions(result.components, {
      inputDir: path.dirname(input),
      outDir: "types",
      preamble: "",
      ...opts?.typesOptions,
      exports: result.exports,
    });
  }

  if (opts?.json) {
    writeJson(result.components, {
      outFile: "COMPONENT_API.json",
      ...opts?.jsonOptions,
      input,
    });
  }

  if (opts?.markdown) {
    writeMarkdown(result.components, {
      outFile: "COMPONENT_INDEX.md",
      ...opts?.markdownOptions,
    });
  }
}
