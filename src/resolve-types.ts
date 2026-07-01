import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ParsedComponentTypeScriptMetadata, ResolvedComponentProp } from "./ComponentParser";
import type { ExampleCheckSource } from "./example-check";
import { normalizeSeparators } from "./path";

export interface ResolveTarget {
  moduleName: string;
  filePath: string;
  metadata: ParsedComponentTypeScriptMetadata;
}

export interface ExampleCheckTarget {
  moduleName: string;
  filePath: string;
  sources: ExampleCheckSource[];
}

/** One `@example` block that failed to type-check. */
export interface ExampleCheckDiagnostic {
  id: string;
  name: string;
  message: string;
}

// The opt-in resolution path talks to the TypeScript 7 native preview through
// its (currently unstable) async client/server API. We type it structurally so
// the default AST-only build never needs the `typescript` types.
// biome-ignore lint/suspicious/noExplicitAny: native-preview API is loaded lazily and typed structurally.
type TS = any;

const VIRTUAL_PROPS_BINDING = "__sveld_resolved_props__";
const VIRTUAL_PROPS_TYPE = "__SveldResolvedProps__";
const TRAILING_UNDEFINED = / \| undefined$/;
const NON_FILENAME_CHAR_REGEX = /[^A-Za-z0-9_-]/g;
const NON_IDENTIFIER_CHAR_REGEX = /[^A-Za-z0-9_$]/g;
const LEADING_DIGIT_REGEX = /^[0-9]/;
/** Line 1 of an example virtual file is always the declaration; the example body starts on line 2. */
const EXAMPLE_CODE_START_LINE = 2;

/**
 * Expands opaque imported `$props()` types using the project's TypeScript program.
 * Loaded only when `resolveTypes` is enabled.
 */
export class TypeResolver {
  private readonly api: TS;
  private readonly symbolFlags: TS;
  private readonly tsconfigPath: string;
  private readonly overlay = new Map<string, string>();

  private constructor(api: TS, symbolFlags: TS, tsconfigPath: string) {
    this.api = api;
    this.symbolFlags = symbolFlags;
    this.tsconfigPath = tsconfigPath;
  }

  /**
   * Loads `typescript` and the nearest `tsconfig.json`.
   * Returns `null` when either is missing.
   */
  static async create(cwd: string = process.cwd()): Promise<TypeResolver | null> {
    const tsconfigPath = findTsConfig(cwd);
    if (!tsconfigPath) {
      console.warn("Warning: `resolveTypes` could not locate a tsconfig.json. Skipping semantic resolution.");
      return null;
    }

    let mod: TS;
    try {
      mod = await import("typescript/unstable/async");
    } catch (error) {
      console.warn(
        "Warning: `resolveTypes` requires the `typescript` package to be installed. Skipping semantic resolution.",
        error,
      );
      return null;
    }

    const resolver = new TypeResolver(null, mod.SymbolFlags, tsconfigPath);
    const api = new mod.API({ cwd, fs: resolver.createFileSystem() });
    // biome-ignore lint/suspicious/noExplicitAny: assign after fs closure is created.
    (resolver as any).api = api;
    return resolver;
  }

  /** Resolves every target in one program snapshot. */
  async expandAll(targets: ResolveTarget[]): Promise<Map<string, ResolvedComponentProp[]>> {
    const results = new Map<string, ResolvedComponentProp[]>();
    if (targets.length === 0) return results;

    const virtualFiles = new Map<string, ResolveTarget>();
    for (const target of targets) {
      if (!target.metadata.canonicalPropsType) continue;
      const virtualFile = this.virtualFileName(target.filePath, target.moduleName);
      this.overlay.set(virtualFile, buildVirtualModule(target.metadata));
      virtualFiles.set(virtualFile, target);
    }

    if (virtualFiles.size === 0) return results;

    const snapshot = await this.api.updateSnapshot({
      openProject: this.tsconfigPath,
      fileChanges: { created: Array.from(virtualFiles.keys()) },
    });

    try {
      const entries = await Promise.all(
        Array.from(
          virtualFiles,
          async ([virtualFile, target]): Promise<[string, ResolvedComponentProp[]]> => [
            target.moduleName,
            await this.resolveFile(snapshot, virtualFile),
          ],
        ),
      );
      for (const [moduleName, props] of entries) {
        results.set(moduleName, props);
      }
    } finally {
      await snapshot.dispose?.();
    }

    return results;
  }

  /**
   * Type-checks every `@example` block in one program snapshot.
   *
   * Each example gets its own virtual file: a `declare`-style binding for the
   * documented symbol (typed as `any` end-to-end, so types sveld can't see
   * never cause a false positive), then the example body. Catches renamed
   * or removed symbols and wrong arity. Not full type checking; it does not
   * depend on the rest of the component's types.
   */
  async checkExamples(targets: ExampleCheckTarget[]): Promise<Map<string, ExampleCheckDiagnostic[]>> {
    const results = new Map<string, ExampleCheckDiagnostic[]>();
    if (targets.length === 0) return results;

    const examples: Array<{ moduleName: string; source: ExampleCheckSource; file: string }> = [];
    for (const target of targets) {
      for (const source of target.sources) {
        const file = this.exampleFileName(target.filePath, target.moduleName, source.id);
        this.overlay.set(file, buildExampleModule(source));
        examples.push({ moduleName: target.moduleName, source, file });
      }
    }

    if (examples.length === 0) return results;

    const snapshot = await this.api.updateSnapshot({
      openProject: this.tsconfigPath,
      fileChanges: { created: examples.map((example) => example.file) },
    });

    try {
      await Promise.all(
        examples.map(async ({ moduleName, source, file }) => {
          const project = await snapshot.getDefaultProjectForFile(file);
          if (!project) return;

          const [syntactic, semantic]: [TS[], TS[]] = await Promise.all([
            project.program.getSyntacticDiagnostics(file),
            project.program.getSemanticDiagnostics(file),
          ]);
          const diagnostics = [...syntactic, ...semantic];
          if (diagnostics.length === 0) return;

          const content = this.overlay.get(file) ?? "";
          const message = diagnostics
            .map((diagnostic: TS) => formatExampleDiagnostic(diagnostic, content))
            .sort((a, b) => a.line - b.line)
            .map((entry) => `Line ${entry.line}: ${entry.text}`)
            .join("\n");

          const list = results.get(moduleName) ?? [];
          list.push({ id: source.id, name: source.name, message });
          results.set(moduleName, list);
        }),
      );
    } finally {
      await snapshot.dispose?.();
    }

    return results;
  }

  /** Closes the TypeScript server process. */
  async dispose(): Promise<void> {
    this.overlay.clear();
    await this.api?.close?.();
  }

  private async resolveFile(snapshot: TS, virtualFile: string): Promise<ResolvedComponentProp[]> {
    const content = this.overlay.get(virtualFile);
    if (!content) return [];

    const project = await snapshot.getDefaultProjectForFile(virtualFile);
    if (!project) return [];

    const checker = project.checker;
    const position = bindingPosition(content);
    const type = await checker.getTypeAtPosition(virtualFile, position);
    if (!type) return [];

    const properties: TS[] = await checker.getPropertiesOfType(type);

    const resolved = await Promise.all(
      properties
        // Skip synthetic/internal members.
        .filter((symbol: TS) => symbol.name && !symbol.name.startsWith("__"))
        .map(async (symbol: TS): Promise<ResolvedComponentProp> => {
          const propType = await checker.getTypeOfSymbol(symbol);
          const isOptional = (symbol.flags & this.symbolFlags.Optional) !== 0;
          let typeText = propType ? await checker.typeToString(propType) : "any";
          if (isOptional) typeText = typeText.replace(TRAILING_UNDEFINED, "");

          return { name: symbol.name, type: typeText, isRequired: !isOptional };
        }),
    );

    resolved.sort((a, b) => a.name.localeCompare(b.name));
    return resolved;
  }

  private createFileSystem() {
    return {
      readFile: (fileName: string) => this.overlay.get(normalizeSeparators(fileName)),
      fileExists: (fileName: string) => (this.overlay.has(normalizeSeparators(fileName)) ? true : undefined),
      getAccessibleEntries: (directoryName: string) => {
        const normalizedDir = normalizeSeparators(directoryName);
        const extras = Array.from(this.overlay.keys()).filter(
          (file) => normalizeSeparators(path.dirname(file)) === normalizedDir,
        );
        if (extras.length === 0) return undefined;

        const files: string[] = [];
        const directories: string[] = [];
        try {
          for (const entry of readdirSync(directoryName)) {
            const full = path.join(directoryName, entry);
            try {
              (statSync(full).isDirectory() ? directories : files).push(entry);
            } catch {
              // Ignore unreadable entries.
            }
          }
        } catch {
          // Directory only exists virtually.
        }

        for (const file of extras) {
          const base = path.basename(file);
          if (!files.includes(base)) files.push(base);
        }

        return { files, directories };
      },
    };
  }

  private virtualFileName(componentFilePath: string, moduleName: string) {
    const dir = path.dirname(path.resolve(componentFilePath));
    return normalizeSeparators(path.join(dir, `__sveld_resolved_${moduleName}.ts`));
  }

  private exampleFileName(componentFilePath: string, moduleName: string, exampleId: string) {
    const dir = path.dirname(path.resolve(componentFilePath));
    const safeId = exampleId.replace(NON_FILENAME_CHAR_REGEX, "_");
    return normalizeSeparators(path.join(dir, `__sveld_example_${moduleName}_${safeId}.ts`));
  }
}

function buildVirtualModule(metadata: ParsedComponentTypeScriptMetadata): string {
  return [
    ...metadata.typeImportStatements,
    ...metadata.localTypeDeclarations,
    `type ${VIRTUAL_PROPS_TYPE} = ${metadata.canonicalPropsType};`,
    `declare const ${VIRTUAL_PROPS_BINDING}: ${VIRTUAL_PROPS_TYPE};`,
  ].join("\n");
}

/** Sanitizes a documented symbol's name into a valid binding identifier (e.g. a slot named `"header-icon"`). */
function declarationIdentifier(name: string): string {
  const sanitized = name.replace(NON_IDENTIFIER_CHAR_REGEX, "_");
  if (sanitized === "" || LEADING_DIGIT_REGEX.test(sanitized)) return `_${sanitized}`;
  return sanitized;
}

/** One example, in its own virtual file: a typed binding for the symbol, then the example body. */
function buildExampleModule(source: ExampleCheckSource): string {
  const binding = declarationIdentifier(source.name);
  return `const ${binding} = null as unknown as (${source.type});\n${source.code}\n`;
}

/** Converts a diagnostic's character offset into a line number relative to the example body. */
function formatExampleDiagnostic(diagnostic: TS, content: string): { line: number; text: string } {
  const pos: number = diagnostic.pos ?? 0;
  const virtualLine = content.slice(0, pos).split("\n").length;
  const line = Math.max(1, virtualLine - EXAMPLE_CODE_START_LINE + 1);
  return { line, text: String(diagnostic.text ?? "").trim() };
}

/** Offset of the props binding identifier on the trailing `declare const` line. */
function bindingPosition(content: string): number {
  const declareIndex = content.lastIndexOf("declare const");
  return content.indexOf(VIRTUAL_PROPS_BINDING, declareIndex) + 2;
}

/** Walks upward from `dir` to find the nearest `tsconfig.json`. */
function findTsConfig(dir: string): string | null {
  let current = path.resolve(dir);
  while (true) {
    const candidate = path.join(current, "tsconfig.json");
    if (existsSync(candidate)) return candidate;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
