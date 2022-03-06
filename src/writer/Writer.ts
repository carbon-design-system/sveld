import * as path from "path";
import * as fsp from "fs/promises";
import * as prettier from "prettier";

interface WriterOptions extends Pick<prettier.ParserOptions, "parser" | "printWidth"> {}

export default class Writer {
  options: WriterOptions;

  constructor(options: WriterOptions) {
    this.options = options;
  }

  public format(raw: any) {
    try {
      return prettier.format(raw, this.options);
    } catch (error) {
      console.error(error);
      return raw;
    }
  }

  public async write(filePath: string, raw: any) {
    await fsp.mkdir(path.parse(filePath).dir, { recursive: true });
    await fsp.writeFile(filePath, this.format(raw));
  }
}
