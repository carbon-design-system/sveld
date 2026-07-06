import { mkdir, writeFile } from "node:fs/promises";
import { parse } from "node:path";
import type { ParserOptions } from "prettier";

export const DEFAULT_TYPESCRIPT_PRINT_WIDTH = 80;

// undefined = not yet attempted, null = confirmed unavailable
let prettierModule: typeof import("prettier") | null | undefined;

/**
 * Exposed so tests can simulate prettier being unavailable by stubbing
 * `prettierLoader.load` directly, instead of fighting the module registry to
 * make a real, installed dependency appear missing.
 *
 * @internal
 */
export const prettierLoader = {
  load: (): Promise<typeof import("prettier")> => import("prettier"),
};

/** @internal exposed for tests to reset the module-scope cache between cases */
export function __resetPrettierCacheForTesting(): void {
  prettierModule = undefined;
}

async function loadPrettier(): Promise<typeof import("prettier") | null> {
  if (prettierModule !== undefined) {
    return prettierModule;
  }

  try {
    prettierModule = await prettierLoader.load();
  } catch {
    prettierModule = null;
    console.warn("prettier is not installed; emitting unformatted output. Install prettier for formatted files.");
  }

  return prettierModule;
}

/**
 * Options for configuring a Writer instance.
 *
 * Extends Prettier's ParserOptions with parser and printWidth settings.
 */
interface WriterOptions extends Pick<ParserOptions, "parser" | "printWidth"> {}

/**
 * Base writer class for formatting and writing files.
 *
 * Handles file formatting using Prettier and file system operations.
 * Automatically creates directories as needed and formats content
 * before writing.
 *
 * @example
 * ```ts
 * const writer = new Writer({ parser: "typescript", printWidth: 80 });
 * await writer.write("./dist/index.d.ts", "export type Props = {};");
 * ```
 */
export default class Writer {
  options: WriterOptions;

  /**
   * Creates a new Writer instance.
   *
   * @param options - Writer configuration options
   */
  constructor(options: WriterOptions) {
    this.options = options;
  }

  /**
   * Formats raw content using Prettier.
   *
   * Applies formatting based on the configured parser and print width.
   * Returns the original content if formatting fails.
   *
   * @param raw - The raw content to format
   * @param filePath - Optional file path, included in the error message if formatting fails
   * @returns Formatted content, or original content if formatting fails
   *
   * @example
   * ```ts
   * const formatted = await writer.format("export type Props={}");
   * // Returns: "export type Props = {};\n"
   * ```
   */
  public async format(raw: string, filePath?: string) {
    const prettier = await loadPrettier();

    if (!prettier) {
      return raw;
    }

    try {
      const result = await prettier.format(raw, this.options);
      return result;
    } catch (error) {
      console.error(filePath ? `Failed to format ${filePath}:` : "Failed to format:", error);
      return raw;
    }
  }

  /**
   * Writes formatted content to a file.
   *
   * Creates the directory structure if needed, formats the content,
   * and writes it to the specified file path.
   *
   * @param filePath - The path where the file should be written
   * @param raw - The raw content to format and write
   *
   * @example
   * ```ts
   * await writer.write("./dist/index.d.ts", "export type Props={}");
   * // Creates ./dist/index.d.ts with formatted content
   * ```
   */
  public async write(filePath: string, raw: string) {
    await mkdir(parse(filePath).dir, { recursive: true });
    await writeFile(filePath, await this.format(raw, filePath));
  }
}

/**
 * Creates a Writer instance configured for JSON files.
 *
 * @returns A Writer instance with JSON parser and 80 character print width
 *
 * @example
 * ```ts
 * const writer = createJsonWriter();
 * await writer.write("data.json", JSON.stringify({ key: "value" }));
 * ```
 */
export function createJsonWriter(): Writer {
  return new Writer({ parser: "json", printWidth: 80 });
}

/**
 * Creates a Writer instance configured for TypeScript files.
 *
 * @param printWidth - Prettier print width for emitted TypeScript files
 * @returns A Writer instance with TypeScript parser and 80 character print width by default
 *
 * @example
 * ```ts
 * const writer = createTypeScriptWriter();
 * await writer.write("index.d.ts", "export type Props={};");
 * ```
 */
export function createTypeScriptWriter(printWidth = DEFAULT_TYPESCRIPT_PRINT_WIDTH): Writer {
  return new Writer({ parser: "typescript", printWidth });
}
