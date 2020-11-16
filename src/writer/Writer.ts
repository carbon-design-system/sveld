import * as fs from "fs-extra";
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
      process.stderr.write(error + "\n");
      return raw;
    }
  }

  public async write(filePath: string, raw: any) {
    try {
      await fs.ensureFile(filePath);
      await fs.writeFile(filePath, this.format(raw));
    } catch (error) {
      process.stderr.write(error + "\n");
    }
  }
}
