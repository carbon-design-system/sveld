import { lstatSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NormalizedPath } from "./brands";
import type {
  ComponentDocApi,
  ComponentDocs,
  ComponentParseError,
  GenerateBundleOptions,
  GenerateBundleResult,
} from "./bundle";
import { createExtendsTargetValidator, validateModuleReExportNames } from "./bundle-validation";
import type { ComponentParseResult, ParsedComponent, PendingCrossFileCandidates } from "./ComponentParser";
import {
  type CollectedComponents,
  collectComponents,
  componentModuleName,
  createGlobMergeState,
  type GlobMergeState,
  mergeGlobbedComponents,
} from "./collect-components";
import { resolveCrossFileCandidates } from "./cross-file";
import { appendDiagnostics, applyDiagnosticIgnores, dedupeDiagnostics, type SveldDiagnostic } from "./diagnostics";
import { checkComponentExamples } from "./example-check";
import { ModuleGraph } from "./module-graph";
import { hashSource, ParseCache, resolveCacheFilePath } from "./parse-cache";
import { type EntryExports, parseEntryExports } from "./parse-entry-exports";
import type { ParsedExports } from "./parse-exports";
import { getParserStack, loadParserStack } from "./parser-stack";
import { hasSvelteExtension, normalizeSeparators, SVELTE_EXT_REGEX } from "./path";

type ComponentEntry = [string, ParsedExports[string]];

/** One component file's output, shared by every entry that points at it. */
interface ComponentRecord {
  /**
   * Parsed, with its `@example` blocks checked and its cross-file candidates
   * resolved. The bundle-wide checks run on each build's copy instead, since
   * they depend on the other components.
   */
  component: ParsedComponent;
  /** Modules the cross-file pass read for it; undefined when it had nothing to resolve. */
  crossFileReads?: string[];
}

/** How a component file is named and addressed: from the last `allComponentEntries` entry that points at it. */
interface CanonicalEntry {
  moduleName: string;
  filePath: NormalizedPath;
}

/** Result of {@link Project.update}. */
export interface ProjectUpdate {
  /** The full, updated result (all components, with the affected ones re-parsed). */
  result: GenerateBundleResult;
  /**
   * Absolute paths of the components that were re-parsed (or re-read from
   * the parse cache) and re-resolved: the changed files, newly
   * barrel-exported components, and components that read a changed module.
   * Other components are reused from the previous parse.
   */
  reparsed: string[];
}

/**
 * Reads the given component file paths into a map of path -> contents.
 *
 * Failed reads are recorded as `null` (and logged) so callers can skip them
 * gracefully rather than aborting the whole bundle.
 */
export async function readFileMap(filePaths: Iterable<string>): Promise<Map<string, string | null>> {
  const fileContents = await Promise.all(
    Array.from(filePaths).map(async (filePath) => {
      try {
        const content = await readFile(filePath, "utf-8");
        return { path: filePath, content };
      } catch (error) {
        console.warn(`Warning: Failed to read file ${filePath}:`, error);
        return { path: filePath, content: null };
      }
    }),
  );

  return new Map<string, string | null>(fileContents.map(({ path, content }) => [path, content]));
}

export function reportParseErrors(errors: ComponentParseError[]): void {
  if (errors.length === 0) return;
  console.error(`sveld: failed to parse ${errors.length} component(s):`);
  for (const { filePath, message } of errors) {
    console.error(`  - ${filePath}: ${message}`);
  }
}

/**
 * The components under one entry point: collect -> parse -> check examples
 * -> resolve cross-file candidates, per component file, then the bundle-wide
 * checks on each result. Keeps one record per component file, which both
 * of a result's maps are views of.
 *
 * {@link build} parses everything; {@link update} then re-parses only the
 * components a set of changed files affects (watch mode). Each returns a
 * fresh result, with fresh maps and component objects, so a caller holding
 * an older result never sees it change.
 */
export class Project {
  private readonly input: string;
  private readonly glob: boolean;
  private readonly options: GenerateBundleOptions;
  /** The modules the components and the barrel read, for one {@link build} and its updates. */
  private graph = new ModuleGraph();
  private collected!: CollectedComponents;
  /** The entry barrel's resolved path, or `null` for a directory entry. */
  private entryFile: string | null = null;
  /** Dedupes the files `update()` re-globs, across updates. */
  private globMergeState!: GlobMergeState;
  private cache: ParseCache | undefined;
  private entryExports: EntryExports = [];
  /** The barrel's own diagnostics, attributed to it rather than a component. */
  private entryDiagnostics: SveldDiagnostic[] = [];
  /** Keyed by resolved file path. */
  private readonly records = new Map<string, ComponentRecord>();
  /** Keyed by resolved file path. */
  private readonly parseErrors = new Map<string, ComponentParseError>();
  private canonicalEntries = new Map<string, CanonicalEntry>();
  /** Module names already warned about, so a rebuild doesn't repeat the warning. */
  private readonly warnedModuleNames = new Set<string>();

  constructor(input: string, glob: boolean, options: GenerateBundleOptions = {}) {
    this.input = input;
    this.glob = glob;
    this.options = options;
  }

  private get documentExports(): boolean {
    return this.options.documentExports === true;
  }

  /** Collects and parses every component from scratch. */
  async build(): Promise<GenerateBundleResult> {
    this.graph = new ModuleGraph();
    this.collected = collectComponents(this.input, this.glob, this.documentExports, this.graph);
    this.globMergeState = createGlobMergeState(
      this.collected.allComponentEntries,
      this.collected.resolveComponentFilePath,
    );
    this.entryFile = lstatSync(this.input).isFile() ? resolve(this.input) : null;
    // `cache` is on by default; only an explicit `false` disables it.
    this.cache =
      this.options.cache === false
        ? undefined
        : new ParseCache(resolveCacheFilePath(this.collected.rootDir, this.options.cache ?? true));
    await this.readEntryExports();

    this.records.clear();
    this.parseErrors.clear();
    this.indexEntries();

    await this.process(this.componentPaths());
    reportParseErrors(Array.from(this.parseErrors.values()));
    return this.assemble();
  }

  /**
   * Re-parses the components `changedFilePaths` affect and returns the
   * updated result. A change to the entry barrel re-reads its exports; under
   * `glob`, new component files are picked up. A non-`.svelte` file only
   * re-parses the components the cross-file pass read it for. Must follow a
   * {@link build}.
   */
  async update(changedFilePaths: string[]): Promise<ProjectUpdate> {
    const changed = changedFilePaths.map((path) => resolve(path));
    // A rebuild must see the changed files, and resolve imports against
    // files added since the last pass.
    this.graph.invalidate(...changed);
    if (changed.length === 0) return { result: this.assemble(), reparsed: [] };

    const added = this.entryFile !== null && changed.includes(this.entryFile) ? await this.recollect() : [];
    if (this.glob) {
      const { rootDir, exports, allComponentEntries, resolveComponentFilePath } = this.collected;
      mergeGlobbedComponents(
        this.graph,
        rootDir,
        exports,
        allComponentEntries,
        resolveComponentFilePath,
        this.globMergeState,
      );
    }
    this.indexEntries();

    // A file the barrel stopped exporting (and, under `glob`, that no longer
    // exists) is out of the bundle, along with its parse error.
    const listed = this.componentPaths();
    for (const path of this.records.keys()) {
      if (!listed.has(path)) this.records.delete(path);
    }
    for (const path of this.parseErrors.keys()) {
      if (!listed.has(path)) this.parseErrors.delete(path);
    }

    // A parse reads only its own file, so a component that `@extends` or
    // `import()`s a changed file keeps its parse: the checks that read the
    // target run on every result.
    const readers = Array.from(this.records).flatMap(([path, { crossFileReads }]) =>
      crossFileReads?.some((module) => changed.includes(module)) ? [path] : [],
    );
    const affected = new Set([...changed.filter((path) => SVELTE_EXT_REGEX.test(path)), ...added, ...readers]);
    const targets = new Set(Array.from(listed).filter((path) => affected.has(path)));
    const reparsed = await this.process(targets);

    const result = this.assemble();
    reportParseErrors(result.errors);
    return { result, reparsed };
  }

  /**
   * Re-reads the entry barrel's exports. Returns the paths of components
   * that are newly exported, or whose export now points at another file:
   * those need parsing even if they didn't change.
   */
  private async recollect(): Promise<string[]> {
    const previous = this.collected;
    const next = collectComponents(this.input, this.glob, this.documentExports, this.graph);
    const added: string[] = [];
    for (const [name, entry] of Object.entries(next.exports)) {
      const path = next.resolveComponentFilePath(entry.source);
      const before = Object.hasOwn(previous.exports, name) ? previous.exports[name] : undefined;
      if (before === undefined || previous.resolveComponentFilePath(before.source) !== path) added.push(path);
    }

    this.collected = next;
    this.globMergeState = createGlobMergeState(next.allComponentEntries, next.resolveComponentFilePath);
    await this.readEntryExports();
    return added;
  }

  private async readEntryExports(): Promise<void> {
    // File entry only; directory inputs have no barrel.
    this.entryDiagnostics = [];
    this.entryExports =
      this.documentExports && lstatSync(this.input).isFile()
        ? await parseEntryExports(resolve(this.input), { diagnostics: this.entryDiagnostics, graph: this.graph })
        : [];
  }

  /** Every listed `.svelte` file, exported entries first. */
  private componentPaths(): Set<string> {
    const { exports, allComponentEntries, resolveComponentFilePath } = this.collected;
    const paths = new Set<string>();
    for (const [, entry] of [...Object.entries(exports), ...allComponentEntries]) {
      if (hasSvelteExtension(entry.source)) paths.add(resolveComponentFilePath(entry.source));
    }
    return paths;
  }

  /** Refreshes {@link canonicalEntries} after the entry lists change. */
  private indexEntries(): void {
    const { exports, allComponentEntries, resolveComponentFilePath } = this.collected;
    this.canonicalEntries = new Map();
    for (const entries of [Object.entries(exports), allComponentEntries]) {
      for (const [exportName, entry] of entries) {
        if (!hasSvelteExtension(entry.source)) continue;
        this.canonicalEntries.set(resolveComponentFilePath(entry.source), {
          moduleName: componentModuleName(exportName, entry.source, entries.length, this.warnedModuleNames),
          filePath: normalizeSeparators(entry.source),
        });
      }
    }
  }

  private canonicalEntry(resolvedPath: string): CanonicalEntry {
    const entry = this.canonicalEntries.get(resolvedPath);
    if (entry === undefined) throw new Error(`sveld: no entry lists ${resolvedPath}.`);
    return entry;
  }

  /**
   * Parses and settles `paths`, replacing their records and parse errors.
   * Nothing is replaced if a step throws, so a failed update leaves the
   * previous output in place. Returns the paths that now have a record.
   */
  private async process(paths: Set<string>): Promise<string[]> {
    const errors = new Map<string, ComponentParseError>();
    const parsed = await this.parse(paths, errors);
    this.cache?.save();
    const records = await this.settle(parsed);

    for (const path of paths) {
      this.records.delete(path);
      this.parseErrors.delete(path);
    }
    for (const [path, record] of records) this.records.set(path, record);
    for (const [path, error] of errors) this.parseErrors.set(path, error);
    return Array.from(records.keys());
  }

  /**
   * Parses `paths`, reusing the parse cache where a file's content is
   * unchanged. A file that can't be read is left out; one that fails to
   * parse is recorded in `errors` (or thrown with `failFast`).
   */
  private async parse(
    paths: Set<string>,
    errors: Map<string, ComponentParseError>,
  ): Promise<Map<string, ComponentParseResult>> {
    const sources = await readFileMap(paths);
    const cache = this.cache;

    const hashes = new Map<string, string>();
    const misses = new Set<string>();
    if (cache) {
      for (const [path, source] of sources) {
        if (source === null) continue;
        const hash = hashSource(source);
        hashes.set(path, hash);
        if (!cache.has(path, hash)) misses.add(path);
      }
    }

    // Without a cache every component is parsed fresh; with one, only load the
    // parser stack when at least one component actually needs (re)parsing, so
    // a fully cached run skips it entirely.
    if (paths.size > 0 && (!cache || misses.size > 0)) {
      await loadParserStack();
    }

    const parsed = new Map<string, ComponentParseResult>();
    for (const path of paths) {
      const source = sources.get(path);
      if (source === null || source === undefined) continue;
      const result = this.parseOne(path, source, hashes.get(path), errors);
      if (result) parsed.set(path, result);
    }

    return parsed;
  }

  private parseOne(
    path: string,
    source: string,
    hash: string | undefined,
    errors: Map<string, ComponentParseError>,
  ): ComponentParseResult | undefined {
    const cached = hash === undefined ? null : this.cache?.get(path, hash);
    if (cached) return cached;

    const { moduleName, filePath } = this.canonicalEntry(path);
    let result: ComponentParseResult;
    try {
      result = new (getParserStack().ComponentParser)().parse(source, { moduleName, filePath });
    } catch (error) {
      // Capture the failure so the remaining components can still be
      // processed, unless `failFast` asks to abort on the first one.
      if (this.options.failFast) throw error;
      errors.set(path, {
        filePath,
        moduleName,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return undefined;
    }

    if (hash !== undefined) this.cache?.set(path, hash, result);
    return result;
  }

  /** Checks examples and resolves cross-file candidates for freshly parsed components. */
  private async settle(parsed: Map<string, ComponentParseResult>): Promise<Map<string, ComponentRecord>> {
    const { rootDir, resolveComponentFilePath } = this.collected;
    const docs = new Map<string, ComponentDocApi>();
    const pendingByDoc = new Map<ComponentDocApi, PendingCrossFileCandidates | undefined>();
    for (const [path, { component, pending }] of parsed) {
      const doc: ComponentDocApi = { ...this.canonicalEntry(path), ...component };
      docs.set(path, doc);
      pendingByDoc.set(doc, pending);
    }

    const { checkExamples } = this.options;
    if (checkExamples) {
      const found = await checkComponentExamples(docs.values(), checkExamples, rootDir, resolveComponentFilePath);
      for (const [doc, diagnostics] of found) appendDiagnostics(doc, diagnostics);
    }

    const reads = await resolveCrossFileCandidates(
      docs.values(),
      resolveComponentFilePath,
      (doc) => pendingByDoc.get(doc),
      this.graph,
    );

    const records = new Map<string, ComponentRecord>();
    for (const [path, doc] of docs) {
      const { moduleName: _moduleName, filePath, ...component } = doc;
      const crossFileReads = reads.get(filePath);
      records.set(path, crossFileReads === undefined ? { component } : { component, crossFileReads });
    }
    return records;
  }

  /** Builds a fresh result from the records: one view per entry, then the bundle-wide checks. */
  private assemble(): GenerateBundleResult {
    const { exports, allComponentEntries, resolveComponentFilePath } = this.collected;
    const cache = this.cache;

    const view = (entries: ComponentEntry[], [exportName, entry]: ComponentEntry) => {
      if (!hasSvelteExtension(entry.source)) return undefined;
      const record = this.records.get(resolveComponentFilePath(entry.source));
      if (record === undefined) return undefined;
      const component: ComponentDocApi = {
        moduleName: componentModuleName(exportName, entry.source, entries.length, this.warnedModuleNames),
        filePath: normalizeSeparators(entry.source),
        ...record.component,
      };
      return { component, record };
    };

    // Keyed by filePath: two globbed files can share a moduleName.
    const allComponentsForTypes: ComponentDocs = new Map();
    // filePath -> resolved source path for the write-phase text cache, keyed
    // like `cache`. Components whose output was also read from other files
    // go in `crossFileResolvedPathByFilePath` instead: the text cache keys
    // theirs on their content too, since their own source doesn't fix it.
    const resolvedPathByFilePath = cache ? new Map<string, string>() : undefined;
    const crossFileResolvedPathByFilePath = cache ? new Map<string, string>() : undefined;
    const readsOtherFiles = new Set<string>();
    for (const entry of allComponentEntries) {
      const found = view(allComponentEntries, entry);
      if (found === undefined) continue;
      allComponentsForTypes.set(found.component.filePath, found.component);
      resolvedPathByFilePath?.set(found.component.filePath, resolveComponentFilePath(entry[1].source));
      if (found.record.crossFileReads !== undefined) readsOtherFiles.add(found.component.filePath);
    }
    if (resolvedPathByFilePath && crossFileResolvedPathByFilePath) {
      for (const filePath of allComponentsForTypes.keys()) {
        const resolvedPath = resolvedPathByFilePath.get(filePath);
        if (!readsOtherFiles.has(filePath) || resolvedPath === undefined) continue;
        resolvedPathByFilePath.delete(filePath);
        crossFileResolvedPathByFilePath.set(filePath, resolvedPath);
      }
    }

    const validateExtendsTarget = createExtendsTargetValidator(
      allComponentsForTypes,
      resolveComponentFilePath,
      this.graph,
    );
    for (const component of allComponentsForTypes.values()) {
      appendDiagnostics(component, [...validateExtendsTarget(component), ...validateModuleReExportNames(component)]);
    }

    // Keyed by moduleName, unique here: it's the barrel's export name.
    const components: ComponentDocs = new Map();
    const exportEntries = Object.entries(exports);
    for (const entry of exportEntries) {
      const found = view(exportEntries, entry);
      if (found === undefined) continue;
      const checked = allComponentsForTypes.get(found.component.filePath);
      if (checked) found.component.diagnostics = checked.diagnostics;
      components.set(found.component.moduleName, found.component);
    }

    return {
      exports,
      entryExports: this.entryExports,
      components,
      allComponentsForTypes,
      errors: Array.from(this.parseErrors.values()),
      diagnostics: applyDiagnosticIgnores(
        dedupeDiagnostics([
          ...Array.from(allComponentsForTypes.values()).flatMap((component) => component.diagnostics ?? []),
          ...this.entryDiagnostics,
        ]),
        this.options.diagnostics?.ignore,
      ),
      cache,
      resolvedPathByFilePath,
      crossFileResolvedPathByFilePath,
    };
  }
}
