import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeBuildId } from "../scripts/build-id";

describe("computeBuildId", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-build-id-"));
    mkdirSync(join(dir, "src", "parser"), { recursive: true });
    writeFileSync(join(dir, "src", "index.ts"), "export const a = 1;\n");
    writeFileSync(join(dir, "src", "parser", "jsdoc.ts"), "export const b = 2;\n");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("is stable for the same sources and changes when any source file changes", () => {
    const first = computeBuildId(join(dir, "src"));
    expect(computeBuildId(join(dir, "src"))).toBe(first);

    writeFileSync(join(dir, "src", "parser", "jsdoc.ts"), "export const b = 3;\n");
    const edited = computeBuildId(join(dir, "src"));
    expect(edited).not.toBe(first);

    writeFileSync(join(dir, "src", "parser", "new.ts"), "export {};\n");
    expect(computeBuildId(join(dir, "src"))).not.toBe(edited);
  });
});
