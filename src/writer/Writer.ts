import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parse } from "node:path";

export default class Writer {
  private readonly ensuredDirs = new Set<string>();

  /** Skips unchanged files so their mtime is preserved. Returns whether the file was written. */
  public async write(filePath: string, raw: string): Promise<boolean> {
    try {
      if ((await readFile(filePath, "utf-8")) === raw) {
        return false;
      }
    } catch {
      // Missing or unreadable: write it.
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
