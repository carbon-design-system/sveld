import { lstatSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, parse, relative, resolve } from "node:path";
import { parse as parseSvelte } from "svelte/compiler";
import { globSync } from "tinyglobby";
import ComponentParser, { type ParsedComponent } from "./ComponentParser";
import { getSvelteEntry } from "./get-svelte-entry";
import { type ParsedExports, parseExports } from "./parse-exports";
import { normalizeSeparators } from "./path";
import writeJson, { type WriteJsonOptions } from "./writer/writer-json";
import writeMarkdown, { type WriteMarkdownOptions } from "./writer/writer-markdown";
import writeTsDefinitions, { type WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";

export interface SveldOptions {
  /**
   * Specify the input to the uncompiled Svelte source.
   * Programmatic callers historically use `input`; plugin callers use `entry`.
   */
  input?: string;
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

export interface GenerateBundleResult {
  exports: ParsedExports;
  components: ComponentDocs;
  allComponentsForTypes: ComponentDocs;
}

export interface SveldDocument extends GenerateBundleResult {
  input: string;
  inputDir: string;
}

export type SveldOutputKind = "types" | "json" | "markdown";

export interface SveldWriteResult {
  document: SveldDocument;
  written: SveldOutputKind[];
}

export interface SveldDocumenter {
  inspect(opts?: SveldOptions): Promise<SveldDocument | undefined>;
  write(opts?: SveldOptions): Promise<SveldWriteResult | undefined>;
}

export interface SveldAdapters {
  resolveInput(opts?: SveldOptions): string | null;
  generateBundle(input: string, glob: boolean): Promise<GenerateBundleResult>;
  writeOutput(
    result: GenerateBundleResult,
    opts: Omit<SveldOptions, "input">,
    input: string,
  ): Promise<SveldOutputKind[]>;
}

const STYLE_TAG_REGEX = /<style.+?<\/style>/gims;
const HYPHEN_REGEX = /-/g;

function stripTopLevelStyleBlock(source: string) {
  try {
    const parsed = parseSvelte(source, { modern: false }) as { css?: { start?: number; end?: number } };
    const start = parsed.css?.start;
    const end = parsed.css?.end;

    if (start === undefined || end === undefined) {
      return source;
    }

    return `${source.slice(0, start)}${source.slice(end)}`;
  } catch {
    // Fall back to the previous regex behavior if the source cannot be parsed.
    return source.replace(STYLE_TAG_REGEX, "");
  }
}

function resolveSveldInput(opts?: SveldOptions) {
  return getSvelteEntry(opts?.input ?? opts?.entry);
}

export function createSveld(adapters: Partial<SveldAdapters> = {}): SveldDocumenter {
  const resolveInput = adapters.resolveInput ?? resolveSveldInput;
  const generate = adapters.generateBundle ?? generateBundle;
  const writeOutputs = adapters.writeOutput ?? writeOutput;

  const inspect: SveldDocumenter["inspect"] = async (opts?: SveldOptions) => {
    const input = resolveInput(opts);
    if (input === null) return undefined;

    return {
      input,
      inputDir: dirname(input),
      ...(await generate(input, opts?.glob === true)),
    };
  };

  return {
    inspect,
    async write(opts?: SveldOptions) {
      const document = await inspect(opts);
      if (document === undefined) return undefined;

      const written = await writeOutputs(document, opts || {}, document.input);

      return {
        document,
        written,
      };
    },
  };
}

/**
 * Generates component documentation bundle from Svelte source files.
 *
 * Parses exports, discovers components (optionally via glob), and processes
 * all Svelte files to extract component metadata. Returns both exported
 * components (for JSON/Markdown) and all components (for TypeScript definitions).
 */
export async function generateBundle(input: string, glob: boolean): Promise<GenerateBundleResult> {
  const isFile = lstatSync(input).isFile();
  const dir = isFile ? dirname(input) : input;
  const rootDir = resolve(dir);
  const resolveComponentFilePath = (filePath: string) =>
    isAbsolute(filePath) ? resolve(filePath) : resolve(rootDir, filePath);

  let exports: ParsedExports = {};
  if (isFile) {
    const entry = readFileSync(input, "utf-8");
    exports = parseExports(entry, rootDir);
  }

  const allComponents: ParsedExports = { ...exports };

  if (glob) {
    for (const matchedFile of globSync(["**/*.svelte"], { cwd: rootDir, absolute: true })) {
      const file = resolve(matchedFile);
      const moduleName = parse(file).name.replace(HYPHEN_REGEX, "");
      const source = normalizeSeparators(`./${relative(rootDir, file)}`);

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
      uniqueFilePaths.add(resolveComponentFilePath(filePath));
    }
  }
  for (const [, entry] of allComponentEntries) {
    const filePath = entry.source;
    const { ext } = parse(filePath);
    if (ext === ".svelte") {
      uniqueFilePaths.add(resolveComponentFilePath(filePath));
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
      const resolvedPath = resolveComponentFilePath(filePath);
      const source = fileMap.get(resolvedPath);

      if (source === null || source === undefined) {
        return null;
      }

      const parser = new ComponentParser();
      const parsed = parser.parseSvelteComponent(stripTopLevelStyleBlock(source), {
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

  const componentPromises = exportEntries.map((entry) => processComponent(entry, exportEntries, fileMap));
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

/**
 * Writes output files based on sveld options.
 */
export async function writeOutput(
  result: GenerateBundleResult,
  opts: Omit<SveldOptions, "input">,
  input: string,
): Promise<SveldOutputKind[]> {
  const inputDir = dirname(input);
  const written: SveldOutputKind[] = [];

  if (opts?.types !== false) {
    await writeTsDefinitions(result.allComponentsForTypes, {
      outDir: "types",
      preamble: "",
      ...opts?.typesOptions,
      exports: result.exports,
      inputDir,
    });
    written.push("types");
  }

  if (opts?.json) {
    await writeJson(result.components, {
      outFile: "COMPONENT_API.json",
      ...opts?.jsonOptions,
      input,
      inputDir,
    });
    written.push("json");
  }

  if (opts?.markdown) {
    await writeMarkdown(result.components, {
      outFile: "COMPONENT_INDEX.md",
      ...opts?.markdownOptions,
    });
    written.push("markdown");
  }

  return written;
}
