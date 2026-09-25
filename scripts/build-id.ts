import { hash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A fingerprint of every file under `srcDir`: path and contents, in a fixed
 * order. The build bakes it into `lib/` so the parse cache, which is keyed on
 * the sveld version, still misses after a rebuild from changed sources that
 * didn't bump the version (local builds, e2e, git dependencies).
 */
export function computeBuildId(srcDir: string): string {
  const files = readdirSync(srcDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  const contents = files.map((file) => `${relative(srcDir, file)}\0${readFileSync(file, "utf-8")}`).join("\0");
  return hash("sha256", contents, "hex").slice(0, 16);
}
