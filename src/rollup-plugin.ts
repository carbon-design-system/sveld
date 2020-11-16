import * as Rollup from "rollup";
import * as fs from "fs-extra";
import * as path from "path";
import writeTsDefinitions, { WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";
import writeJson, { WriteJsonOptions } from "./writer/writer-json";
import writeMarkdown, { WriteMarkdownOptions } from "./writer/writer-markdown";
import ComponentParser, { ParsedComponent } from "./ComponentParser";

interface PluginSveldOptions {
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
  let exports: string[] = [];
  let rendered_exports: string[] = [];
  let default_export: { moduleName: null | string; only: boolean } = {
    moduleName: null,
    only: false,
  };
  let components: ComponentDocs = new Map();

  const parser = new ComponentParser();

  return {
    name: "plugin-sveld",
    async generateBundle({}, bundle: Rollup.OutputBundle) {
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
                  filePath,
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
    },
    writeBundle() {
      if (opts?.types !== false) {
        writeTsDefinitions(components, {
          inputDir: "src",
          outDir: "types",
          preamble: "",
          ...opts?.typesOptions,
          exports,
          default_export,
          rendered_exports,
        });
      }

      if (opts?.json) {
        writeJson(components, {
          outFile: "COMPONENT_API.json",
          ...opts?.jsonOptions,
        });
      }

      if (opts?.markdown) {
        writeMarkdown(components, {
          outFile: "COMPONENT_INDEX.md",
          ...opts?.markdownOptions,
        });
      }
    },
  };
}
