import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ParsedComponentTypeScriptMetadata, ResolvedComponentProp } from "./ComponentParser";
import { normalizeSeparators } from "./path";

export interface ResolveTarget {
  moduleName: string;
  filePath: string;
  metadata: ParsedComponentTypeScriptMetadata;
}

// The opt-in resolution path talks to the TypeScript 7 native preview through
// its (currently unstable) async client/server API. We type it structurally so
// the default AST-only build never needs the `typescript` types.
// biome-ignore lint/suspicious/noExplicitAny: native-preview API is loaded lazily and typed structurally.
type TS = any;

const VIRTUAL_PROPS_BINDING = "__sveld_resolved_props__";
const VIRTUAL_PROPS_TYPE = "__SveldResolvedProps__";
const TRAILING_UNDEFINED = / \| undefined$/;

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
}

function buildVirtualModule(metadata: ParsedComponentTypeScriptMetadata): string {
  return [
    ...metadata.typeImportStatements,
    ...metadata.localTypeDeclarations,
    `type ${VIRTUAL_PROPS_TYPE} = ${metadata.canonicalPropsType};`,
    `declare const ${VIRTUAL_PROPS_BINDING}: ${VIRTUAL_PROPS_TYPE};`,
  ].join("\n");
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
