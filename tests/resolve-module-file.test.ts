import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resetDirectoryListings } from "../src/fs-listing";
import { resolveModuleFile } from "../src/parse-entry-exports";

/**
 * `resolveModuleFile` decides file-vs-directory from the cached `readdir`
 * listing (`Dirent`) when the specifier names an entry exactly, and only
 * falls back to `lstat` for a case/normalization variant. Both describe a
 * symlink itself rather than its target, so the two paths must agree.
 */
describe("resolveModuleFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-resolve-module-file-"));
    mkdirSync(path.join(dir, "Button"));
    writeFileSync(path.join(dir, "Button", "index.js"), "export {};\n");
    writeFileSync(path.join(dir, "utils.ts"), "export {};\n");
    mkdirSync(path.join(dir, "Both"));
    writeFileSync(path.join(dir, "Both", "index.js"), "export {};\n");
    writeFileSync(path.join(dir, "Both.js"), "export {};\n");
    symlinkSync(path.join(dir, "utils.ts"), path.join(dir, "LinkedFile.ts"));
    symlinkSync(path.join(dir, "Button"), path.join(dir, "LinkedDir"));
    resetDirectoryListings();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    resetDirectoryListings();
  });

  test("resolves a directory specifier to its index file and a bare name to its extension", () => {
    expect(resolveModuleFile("./Button", dir)).toBe(path.join(dir, "Button", "index.js"));
    expect(resolveModuleFile("./utils", dir)).toBe(path.join(dir, "utils.ts"));
    expect(resolveModuleFile("./utils.ts", dir)).toBe(path.join(dir, "utils.ts"));
  });

  test("prefers a sibling file with an extension over a same-named directory's index", () => {
    expect(resolveModuleFile("./Both", dir)).toBe(path.join(dir, "Both.js"));
  });

  test("resolves a .js-family specifier to the TypeScript file it stands for", () => {
    writeFileSync(path.join(dir, "state.svelte.ts"), "export {};\n");
    writeFileSync(path.join(dir, "esm.mts"), "export {};\n");
    writeFileSync(path.join(dir, "view.tsx"), "export {};\n");
    writeFileSync(path.join(dir, "Both.ts"), "export {};\n");
    resetDirectoryListings();

    expect(resolveModuleFile("./utils.js", dir)).toBe(path.join(dir, "utils.ts"));
    expect(resolveModuleFile("./state.svelte.js", dir)).toBe(path.join(dir, "state.svelte.ts"));
    expect(resolveModuleFile("./esm.mjs", dir)).toBe(path.join(dir, "esm.mts"));
    expect(resolveModuleFile("./view.jsx", dir)).toBe(path.join(dir, "view.tsx"));
    // A .js file that exists wins over its .ts twin.
    expect(resolveModuleFile("./Both.js", dir)).toBe(path.join(dir, "Both.js"));
    expect(resolveModuleFile("./nope.js", dir)).toBeNull();
  });

  test("returns null for a missing specifier", () => {
    expect(resolveModuleFile("./nope", dir)).toBeNull();
  });

  test("never resolves a bare package specifier to a file next to the importer", () => {
    expect(resolveModuleFile("utils", dir)).toBeNull();
    expect(resolveModuleFile("Button", dir)).toBeNull();
    expect(resolveModuleFile("./utils", dir)).toBe(path.join(dir, "utils.ts"));
    expect(resolveModuleFile(path.join(dir, "utils"), dir)).toBe(path.join(dir, "utils.ts"));
    expect(resolveModuleFile("../utils", path.join(dir, "Button"))).toBe(path.join(dir, "utils.ts"));
  });

  test("treats a symlink named exactly by the specifier like lstat does: neither file nor directory", () => {
    // Neither `Dirent` nor `lstat` reports a symlink as a file or directory,
    // so an exactly-named symlink has never resolved here, while the
    // extension probe (which never inspects the entry type) still finds a
    // symlinked `.ts`. Pinned so a change to either path is deliberate.
    expect(resolveModuleFile("./LinkedFile.ts", dir)).toBeNull();
    expect(resolveModuleFile("./LinkedDir", dir)).toBeNull();
    expect(resolveModuleFile("./LinkedFile", dir)).toBe(path.join(dir, "LinkedFile.ts"));
  });

  test("resolves a case variant through the lstat fallback on a case-insensitive filesystem", () => {
    const caseInsensitive = existsSync(path.join(dir, "BUTTON"));
    if (!caseInsensitive) return;
    expect(resolveModuleFile("./button", dir)).toBe(path.join(dir, "button", "index.js"));
    expect(resolveModuleFile("./UTILS", dir)).toBe(path.join(dir, "UTILS.ts"));
  });
});
