import { mkdir, writeFile } from "node:fs/promises";
import { parse } from "node:path";

/**
 * Base writer class for file system operations.
 *
 * Automatically creates directories as needed before writing.
 *
 * @example
 * ```ts
 * const writer = new Writer();
 * await writer.write("./dist/index.d.ts", "export type Props = {};");
 * ```
 */
export default class Writer {
  /**
   * Writes content to a file.
   *
   * Creates the directory structure if needed, then writes the content
   * to the specified file path.
   *
   * @param filePath - The path where the file should be written
   * @param raw - The content to write
   *
   * @example
   * ```ts
   * await writer.write("./dist/index.d.ts", "export type Props={}");
   * // Creates ./dist/index.d.ts with the given content
   * ```
   */
  public async write(filePath: string, raw: string) {
    await mkdir(parse(filePath).dir, { recursive: true });
    await writeFile(filePath, raw);
  }
}

/**
 * Creates a Writer instance for JSON files.
 *
 * @returns A Writer instance
 *
 * @example
 * ```ts
 * const writer = createJsonWriter();
 * await writer.write("data.json", JSON.stringify({ key: "value" }));
 * ```
 */
export function createJsonWriter(): Writer {
  return new Writer();
}

/**
 * Creates a Writer instance for TypeScript files.
 *
 * @returns A Writer instance
 *
 * @example
 * ```ts
 * const writer = createTypeScriptWriter();
 * await writer.write("index.d.ts", "export type Props={};");
 * ```
 */
export function createTypeScriptWriter(): Writer {
  return new Writer();
}
