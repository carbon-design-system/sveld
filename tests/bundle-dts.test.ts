import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { bundleDts } from "../scripts/bundle-dts";

const ROOT = resolve(import.meta.dir, "..");

describe("bundleDts", () => {
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(ROOT, ".tmp-sveld-bundle-dts-"));
    await bundleDts({
      root: ROOT,
      entries: [
        { name: "index", source: join(ROOT, "src/index.ts"), outFile: join(dir, "index.d.ts") },
        { name: "browser", source: join(ROOT, "src/browser.ts"), outFile: join(dir, "browser.d.ts") },
      ],
    });
  }, 60_000);

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // A suffix match once rolled another module's `index.ts` up as the
  // package's `index.d.ts`, publishing types with nothing but `parse`.
  test("rolls up src/index.ts's public API, not another index.ts", () => {
    const text = readFileSync(join(dir, "index.d.ts"), "utf8");

    expect(text).toContain("export declare function sveld(");
    expect(text).toContain("export declare function defineConfig(");
    expect(text).toContain("export default function pluginSveld(");
    expect(text).not.toContain("export declare function parse(source: string): unknown;");
  });

  test("rolls up src/browser.ts's public API", () => {
    const text = readFileSync(join(dir, "browser.d.ts"), "utf8");

    expect(text).toContain("ComponentParser");
  });
});
