import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parse } from "node:path";

export default class Writer {
  /**
   * Skips the write when `filePath` already contains `raw`, so repeated runs
   * over unchanged sources don't touch the file (or its mtime).
   *
   * @returns `true` if the file was written, `false` if it was already up to date.
   *
   * @example
   * ```ts
   * const writer = new Writer();
   * await writer.write("./dist/index.d.ts", "export type Props = {};");
   * ```
   */
  public async write(filePath: string, raw: string): Promise<boolean> {
    try {
      if ((await readFile(filePath, "utf-8")) === raw) {
        return false;
      }
    } catch {
      // File doesn't exist yet (or can't be read); fall through to write it.
    }

    await mkdir(parse(filePath).dir, { recursive: true });
    await writeFile(filePath, raw);
    return true;
  }
}

/**
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
 * @example
 * ```ts
 * const writer = createTypeScriptWriter();
 * await writer.write("index.d.ts", "export type Props = {};");
 * ```
 */
export function createTypeScriptWriter(): Writer {
  return new Writer();
}
