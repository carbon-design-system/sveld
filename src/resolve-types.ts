import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { ExampleCheckSource } from "./example-check";
import { normalizeSeparators } from "./path";

interface ExampleCheckTarget {
  moduleName: string;
  filePath: string;
  sources: ExampleCheckSource[];
}

/** One `@example` block that failed to type-check. */
interface ExampleCheckDiagnostic {
  id: string;
  name: string;
  message: string;
}

// Structural types for `typescript/unstable/async` so AST-only builds skip the `typescript` package.
// biome-ignore lint/suspicious/noExplicitAny: native-preview API is loaded lazily and typed structurally.
type TS = any;

const NON_FILENAME_CHAR_REGEX = /[^A-Za-z0-9_-]/g;
const NON_IDENTIFIER_CHAR_REGEX = /[^A-Za-z0-9_$]/g;
const LEADING_DIGIT_REGEX = /^[0-9]/;
const EXAMPLE_CODE_START_LINE = 2;
const MIN_SUPPORTED_TS_MAJOR = 7;
const REQUIREMENT_TEXT = `TypeScript ${MIN_SUPPORTED_TS_MAJOR} or later, which provides \`typescript/unstable/async\``;

interface TypeScriptLoadResult {
  installed: boolean;
  version?: string;
  module?: TS;
}

type TypeResolverCreateResult =
  | { ok: true; resolver: TypeResolver }
  | { ok: false; reason: "not-installed" | "unsupported-version" | "no-tsconfig"; message: string };

interface TypeResolverCreateOptions {
  /** Test seam: replaces the real `typescript` package lookup/import. */
  importTs?: (cwd: string) => Promise<TypeScriptLoadResult>;
}

function isSupportedVersion(version: string | undefined): boolean {
  if (!version) return false;
  const major = Number.parseInt(version, 10);
  return Number.isFinite(major) && major >= MIN_SUPPORTED_TS_MAJOR;
}

async function defaultImportTs(cwd: string): Promise<TypeScriptLoadResult> {
  let version: string | undefined;
  try {
    const require = createRequire(path.join(cwd, "package.json"));
    const pkgPath = require.resolve("typescript/package.json");
    version = (JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string }).version;
  } catch {
    return { installed: false };
  }

  if (!isSupportedVersion(version)) return { installed: true, version };

  try {
    const module = await import("typescript/unstable/async");
    return { installed: true, version, module };
  } catch {
    return { installed: true, version };
  }
}

/**
 * Type-checks `@example` blocks against the project's TypeScript program.
 * Loaded only when `checkExamples` has plain TS/JS examples to check.
 */
export class TypeResolver {
  // Assigned in `create()`, after `createFileSystem()` can close over `this`.
  private api: TS = null;
  private readonly tsconfigPath: string;
  private readonly overlay = new Map<string, string>();

  private constructor(tsconfigPath: string) {
    this.tsconfigPath = tsconfigPath;
  }

  /** Loads `typescript` and the nearest `tsconfig.json`; the caller decides whether a failure is fatal. */
  static async create(
    cwd: string = process.cwd(),
    { importTs = defaultImportTs }: TypeResolverCreateOptions = {},
  ): Promise<TypeResolverCreateResult> {
    const loaded = await importTs(cwd);

    if (!loaded.installed) {
      return {
        ok: false,
        reason: "not-installed",
        message: `requires the \`typescript\` package to be installed (${REQUIREMENT_TEXT}); none was found`,
      };
    }

    if (!loaded.module) {
      return {
        ok: false,
        reason: "unsupported-version",
        message: `requires ${REQUIREMENT_TEXT}; found \`typescript@${loaded.version ?? "unknown"}\` installed, which does not expose that module`,
      };
    }

    const tsconfigPath = findTsConfig(cwd);
    if (!tsconfigPath) {
      return {
        ok: false,
        reason: "no-tsconfig",
        message: `could not locate a tsconfig.json starting from "${cwd}"`,
      };
    }

    const resolver = new TypeResolver(tsconfigPath);
    resolver.api = new loaded.module.API({ cwd, fs: resolver.createFileSystem() });
    return { ok: true, resolver };
  }

  /**
   * Type-checks every `@example` block in one program snapshot, keyed by
   * `filePath`. Each example is a virtual file: a binding for the documented
   * symbol, typed `any` end-to-end so types sveld can't see never cause a
   * false positive, then the body. Catches renamed or removed symbols and
   * wrong arity, not full type errors.
   */
  async checkExamples(targets: ExampleCheckTarget[]): Promise<Map<string, ExampleCheckDiagnostic[]>> {
    const results = new Map<string, ExampleCheckDiagnostic[]>();
    const examples: Array<{ filePath: string; source: ExampleCheckSource; file: string }> = [];
    for (const target of targets) {
      for (const source of target.sources) {
        const file = this.exampleFileName(target.filePath, target.moduleName, source.id);
        this.overlay.set(file, buildExampleModule(source));
        examples.push({ filePath: target.filePath, source, file });
      }
    }

    if (examples.length === 0) return results;

    const snapshot = await this.api.updateSnapshot({
      openProject: this.tsconfigPath,
      fileChanges: { created: examples.map((example) => example.file) },
    });

    try {
      const project = await snapshot.getDefaultProjectForFile(examples[0].file);
      if (!project) return results;

      await Promise.all(
        examples.map(async ({ filePath, source, file }) => {
          const [syntactic, semantic]: [TS[], TS[]] = await Promise.all([
            project.program.getSyntacticDiagnostics(file),
            project.program.getSemanticDiagnostics(file),
          ]);
          const diagnostics = [...syntactic, ...semantic];
          if (diagnostics.length === 0) return;

          const content = this.overlay.get(file) ?? "";
          const message = diagnostics
            .map((diagnostic) => formatExampleDiagnostic(diagnostic, content))
            .sort((a, b) => a.line - b.line)
            .map((entry) => `Line ${entry.line}: ${entry.text}`)
            .join("\n");

          const list = results.get(filePath) ?? [];
          list.push({ id: source.id, name: source.name, message });
          results.set(filePath, list);
        }),
      );
    } finally {
      await snapshot.dispose?.();
    }

    return results;
  }

  async dispose(): Promise<void> {
    this.overlay.clear();
    await this.api?.close?.();
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
            } catch {}
          }
        } catch {}

        for (const file of extras) {
          const base = path.basename(file);
          if (!files.includes(base)) files.push(base);
        }

        return { files, directories };
      },
    };
  }

  private exampleFileName(componentFilePath: string, moduleName: string, exampleId: string) {
    const dir = path.dirname(path.resolve(componentFilePath));
    const safeId = exampleId.replace(NON_FILENAME_CHAR_REGEX, "_");
    return normalizeSeparators(path.join(dir, `__sveld_example_${moduleName}_${safeId}.ts`));
  }
}

function declarationIdentifier(name: string): string {
  const sanitized = name.replace(NON_IDENTIFIER_CHAR_REGEX, "_");
  if (sanitized === "" || LEADING_DIGIT_REGEX.test(sanitized)) return `_${sanitized}`;
  return sanitized;
}

function buildExampleModule(source: ExampleCheckSource): string {
  const binding = declarationIdentifier(source.name);
  return `const ${binding} = null as unknown as (${source.type});\n${source.code}\n`;
}

function formatExampleDiagnostic(diagnostic: TS, content: string): { line: number; text: string } {
  const pos: number = diagnostic.pos ?? 0;
  const virtualLine = content.slice(0, pos).split("\n").length;
  const line = Math.max(1, virtualLine - EXAMPLE_CODE_START_LINE + 1);
  return { line, text: String(diagnostic.text ?? "").trim() };
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
