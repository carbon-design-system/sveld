import * as Rollup from "rollup";
import * as fs from "fs-extra";
import * as path from "path";
import writeTsDefinitions, { WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";
import writeJson, { WriteJsonOptions } from "./writer/writer-json";
import writeMarkdown, { WriteMarkdownOptions } from "./writer/writer-markdown";
import ComponentParser, { ParsedComponent } from "./ComponentParser";

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
  let input: string;

  return {
    name: "plugin-sveld",
    buildStart(options: Rollup.InputOptions) {
      if (options.input) {
        input = Array.isArray(options.input) ? options.input[0] : (options.input as string);
      }
    },
    async generateBundle({}, bundle: Rollup.OutputBundle) {
      result = await generateBundle(bundle, input);
    },
    writeBundle() {
      writeOutput(result, opts || {}, input);
    },
  };
}

interface GenerateBundleResult {
  exports: string[];
  rendered_exports: string[];
  default_export: { moduleName: null | string; only: boolean };
  components: ComponentDocs;
}

export async function generateBundle(bundle: Rollup.OutputBundle, input: string) {
  let exports: string[] = [];
  let rendered_exports: string[] = [];
  let default_export: { moduleName: null | string; only: boolean } = {
    moduleName: null,
    only: false,
  };
  let components: ComponentDocs = new Map();

  const parser = new ComponentParser();

  for (const filename in bundle) {
    const chunkOrAsset = bundle[filename];

    if (chunkOrAsset.type !== "asset" && chunkOrAsset.isEntry) {
      exports = chunkOrAsset.exports;

      for (const filePath in chunkOrAsset.modules) {
        // options.input assumes the Rollup entry point is `index.js`
        if (filePath.endsWith("index.js")) {
          rendered_exports = chunkOrAsset.modules[filePath].renderedExports;
        }

        if (!/node_modules/.test(filePath)) {
          const parsed = path.parse(filePath);
          const moduleName = parsed.name;
          const single_default_export = exports.length === 1 && exports[0] === "default";

          if (exports.includes("default")) {
            default_export.moduleName = moduleName;
            default_export.only = single_default_export;
          }

          if (parsed.ext === ".svelte" && (exports.includes(moduleName) || single_default_export)) {
            const source = await fs.readFile(filePath, "utf-8");
            components.set(moduleName, {
              moduleName,
              filePath: path.relative(path.join(process.cwd(), input), filePath).replace(/\..\//g, "./"),
              ...parser.parseSvelteComponent(source, {
                moduleName,
                filePath,
              }),
            });
          }
        }
      }
    }
  }

  return {
    exports,
    rendered_exports,
    default_export,
    components,
  };
}

export function writeOutput(result: GenerateBundleResult, opts: PluginSveldOptions, input: string) {
  if (opts?.types !== false) {
    writeTsDefinitions(result.components, {
      inputDir: "src",
      outDir: "types",
      preamble: "",
      ...opts?.typesOptions,
      exports: result.exports,
      default_export: result.default_export,
      rendered_exports: result.rendered_exports,
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
