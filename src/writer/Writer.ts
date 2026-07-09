import { mkdir, writeFile } from "node:fs/promises";
import { parse } from "node:path";

export default class Writer {
  /**
   * @example
   * ```ts
   * const writer = new Writer();
   * await writer.write("./dist/index.d.ts", "export type Props = {};");
   * ```
   */
  public async write(filePath: string, raw: string) {
    await mkdir(parse(filePath).dir, { recursive: true });
    await writeFile(filePath, raw);
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
