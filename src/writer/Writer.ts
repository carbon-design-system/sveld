import { mkdir, writeFile } from "node:fs/promises";
import { parse } from "node:path";
import { format, type ParserOptions } from "prettier";

interface WriterOptions extends Pick<ParserOptions, "parser" | "printWidth"> {}

export default class Writer {
  options: WriterOptions;

  constructor(options: WriterOptions) {
    this.options = options;
  }

  public async format(raw: string) {
    try {
      const result = await format(raw, this.options);
      return result;
    } catch (error) {
      console.error(error);
      return raw;
    }
  }

  public async write(filePath: string, raw: string) {
    await mkdir(parse(filePath).dir, { recursive: true });
    await writeFile(filePath, await this.format(raw));
  }
}

/**
 * Factory functions for creating Writer instances with common configurations.
 */
export function createJsonWriter(): Writer {
  return new Writer({ parser: "json", printWidth: 80 });
}

export function createTypeScriptWriter(): Writer {
  return new Writer({ parser: "typescript", printWidth: 80 });
}
