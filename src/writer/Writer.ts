import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as prettier from "prettier";

interface WriterOptions extends Pick<prettier.ParserOptions, "parser" | "printWidth"> {}

export default class Writer {
  options: WriterOptions;

  constructor(options: WriterOptions) {
    this.options = options;
  }

  public async format(raw: string) {
    try {
      const result = await prettier.format(raw, this.options);
      return result;
    } catch (error) {
      console.error(error);
      return raw;
    }
  }

  public async write(filePath: string, raw: string) {
    await fsp.mkdir(path.parse(filePath).dir, { recursive: true });
    await fsp.writeFile(filePath, await this.format(raw));
  }
}
