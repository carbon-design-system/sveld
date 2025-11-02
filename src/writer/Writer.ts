import { spawn } from "node:child_process";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as prettier from "prettier";

interface WriterOptions {
  parser: "typescript" | "json" | "markdown";
  printWidth?: number;
  [key: string]: unknown;
}

export default class Writer {
  options: WriterOptions;

  constructor(options: WriterOptions) {
    this.options = options;
  }

  private getFileExtension(): string {
    switch (this.options.parser) {
      case "typescript":
        return ".ts";
      case "json":
        return ".json";
      case "markdown":
        return ".md";
    }
  }

  private async formatWithBiome(raw: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const fileExtension = this.getFileExtension();
      const args = ["biome", "format", "--stdin-file-path", `file${fileExtension}`];

      // Add line-width override if specified
      if (this.options.printWidth !== undefined) {
        args.push(`--line-width=${this.options.printWidth}`);
      }

      const biome = spawn("bun", args);

      let output = "";
      let error = "";

      biome.stdout.on("data", (data) => {
        output += data.toString();
      });

      biome.stderr.on("data", (data) => {
        error += data.toString();
      });

      biome.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error));
        }
      });

      biome.on("error", (err) => {
        reject(err);
      });

      biome.stdin.write(raw, "utf8");
      biome.stdin.end();
    });
  }

  public async format(raw: string): Promise<string> {
    try {
      // Handle non-string inputs by returning them as-is
      if (typeof raw !== "string") {
        return raw;
      }

      // Biome doesn't support Markdown yet, so use Prettier for Markdown files
      if (this.options.parser === "markdown") {
        const result = await prettier.format(raw, this.options);
        return result;
      }

      // Use Biome for TypeScript and JSON
      const result = await this.formatWithBiome(raw);
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
