import { lstatSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, parse, relative, resolve } from "node:path";
import { preprocess } from "svelte/compiler";
import { replace, typescript } from "svelte-preprocess";
import { globSync } from "tinyglobby";
import ComponentParser, { type ParsedComponent } from "./ComponentParser";
import { getSvelteEntry } from "./get-svelte-entry";
import { type ParsedExports, parseExports } from "./parse-exports";
import { normalizeSeparators } from "./path";
import writeJson, { type WriteJsonOptions } from "./writer/writer-json";
import writeMarkdown, { type WriteMarkdownOptions } from "./writer/writer-markdown";
import writeTsDefinitions, { type WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";

export interface PluginSveldOptions {
  /**
   * Specify the entry point to uncompiled Svelte source.
   * If not provided, sveld will use the "svelte" field from package.json.
   */
  entry?: string;
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

const STYLE_TAG_REGEX = /<style.+?<\/style>/gims;
const HYPHEN_REGEX = /-/g;

export default function pluginSveld(opts?: PluginSveldOptions) {
  let result: GenerateBundleResult;
  let input: string | null;

  return {
    name: "plugin-sveld",
    buildStart() {
      input = getSvelteEntry(opts?.entry);
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
  allComponentsForTypes: ComponentDocs;
}

export async function generateBundle(input: string, glob: boolean) {
  const isFile = lstatSync(input).isFile();
  const dir = isFile ? dirname(input) : input;

  // Only parse exports if input is a file
  let exports: ParsedExports = {};
  if (isFile) {
    const entry = readFileSync(input, "utf-8");
    exports = parseExports(entry, dir);
  }

  const allComponents: ParsedExports = { ...exports };

  if (glob) {
    for (const file of globSync([`${dir}/**/*.svelte`])) {
      const moduleName = parse(file).name.replace(HYPHEN_REGEX, "");
      const source = normalizeSeparators(`./${relative(dir, file)}`);

      if (exports[moduleName]) {
        exports[moduleName].source = source;
      }

      if (allComponents[moduleName]) {
        allComponents[moduleName].source = source;
      } else {
        allComponents[moduleName] = { source, default: false };
      }
    }
  }

  const components: ComponentDocs = new Map();
  const allComponentsForTypes: ComponentDocs = new Map();
  const exportEntries = Object.entries(exports);
  const allComponentEntries = Object.entries(allComponents);

  const uniqueFilePaths = new Set<string>();
  for (const [, entry] of exportEntries) {
    const filePath = entry.source;
    const { ext } = parse(filePath);
    if (ext === ".svelte") {
      uniqueFilePaths.add(resolve(dir, filePath));
    }
  }
  for (const [, entry] of allComponentEntries) {
    const filePath = entry.source;
    const { ext } = parse(filePath);
    if (ext === ".svelte") {
      uniqueFilePaths.add(resolve(dir, filePath));
    }
  }

  const fileContents = await Promise.all(
    Array.from(uniqueFilePaths).map(async (filePath) => {
      try {
        const content = await readFile(filePath, "utf-8");
        return { path: filePath, content };
      } catch (error) {
        console.warn(`Warning: Failed to read file ${filePath}:`, error);
        return { path: filePath, content: null };
      }
    }),
  );

  const fileMap = new Map<string, string | null>(fileContents.map(({ path, content }) => [path, content]));

  // Helper function to process a single component
  const processComponent = async (
    [exportName, entry]: [string, ParsedExports[string]],
    entries: Array<[string, ParsedExports[string]]>,
    fileMap: Map<string, string | null>,
  ) => {
    const filePath = entry.source;
    const { ext, name } = parse(filePath);

    let moduleName = exportName;

    if (entries.length === 1 && exportName === "default") {
      moduleName = name;
    }

    if (ext === ".svelte") {
      const resolvedPath = resolve(dir, filePath);
      const source = fileMap.get(resolvedPath);

      if (source === null || source === undefined) {
        // File was not found or failed to read, skip this component
        return null;
      }

      const { code: processed } = await preprocess(source, [typescript(), replace([[STYLE_TAG_REGEX, ""]])], {
        filename: basename(filePath),
      });

      const parser = new ComponentParser();
      const parsed = parser.parseSvelteComponent(processed, {
        moduleName,
        filePath,
      });

      return {
        moduleName,
        filePath,
        ...parsed,
      };
    }

    return null;
  };

  // Process exported components (for metadata/JSON/Markdown)
  const componentPromises = exportEntries.map((entry) => processComponent(entry, exportEntries, fileMap));

  // Process all components (for .d.ts generation)
  const allComponentPromises = allComponentEntries.map((entry) =>
    processComponent(entry, allComponentEntries, fileMap),
  );

  const [results, allResults] = await Promise.all([Promise.all(componentPromises), Promise.all(allComponentPromises)]);

  for (const result of results) {
    if (result) {
      components.set(result.moduleName, result);
    }
  }

  for (const result of allResults) {
    if (result) {
      allComponentsForTypes.set(result.moduleName, result);
    }
  }

  return {
    exports,
    components,
    allComponentsForTypes,
  };
}

export function writeOutput(result: GenerateBundleResult, opts: PluginSveldOptions, input: string) {
  const inputDir = dirname(input);

  if (opts?.types !== false) {
    // Use allComponentsForTypes to generate .d.ts for all discovered components
    writeTsDefinitions(result.allComponentsForTypes, {
      outDir: "types",
      preamble: "",
      ...opts?.typesOptions,
      exports: result.exports,
      inputDir,
    });
  }

  if (opts?.json) {
    // Use components (exported only) for JSON metadata
    writeJson(result.components, {
      outFile: "COMPONENT_API.json",
      ...opts?.jsonOptions,
      input,
      inputDir,
    });
  }

  if (opts?.markdown) {
    // Use components (exported only) for Markdown documentation
    writeMarkdown(result.components, {
      outFile: "COMPONENT_INDEX.md",
      ...opts?.markdownOptions,
    });
  }
}
