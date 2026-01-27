import { mkdir, writeFile } from "node:fs/promises";
import { parse } from "node:path";
import { format, type ParserOptions } from "prettier";

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
   * @returns Formatted content, or original content if formatting fails
   *
   * @example
   * ```ts
   * const formatted = await writer.format("export type Props={}");
   * // Returns: "export type Props = {};\n"
   * ```
   */
  public async format(raw: string) {
    try {
      const result = await format(raw, this.options);
      return result;
    } catch (error) {
      console.error(error);
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
    await writeFile(filePath, await this.format(raw));
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
 * @returns A Writer instance with TypeScript parser and 80 character print width
 *
 * @example
 * ```ts
 * const writer = createTypeScriptWriter();
 * await writer.write("index.d.ts", "export type Props={};");
 * ```
 */
export function createTypeScriptWriter(): Writer {
  return new Writer({ parser: "typescript", printWidth: 80 });
}
