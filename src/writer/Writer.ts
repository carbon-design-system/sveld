import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parse } from "node:path";

export default class Writer {
  /** Directories already created by this writer, so sibling files skip the `mkdir` round trip. */
  private readonly ensuredDirs = new Set<string>();

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

    const dir = parse(filePath).dir;
    if (!this.ensuredDirs.has(dir)) {
      await mkdir(dir, { recursive: true });
      this.ensuredDirs.add(dir);
    }
    await writeFile(filePath, raw);
    return true;
  }
}
