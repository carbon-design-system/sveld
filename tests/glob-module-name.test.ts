import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type ComponentDocApi, type ComponentDocs, generateBundle } from "../src/bundle";

/** Look up `allComponentsForTypes` by filePath; moduleName is not unique. */
function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

const BUTTON = `<script>
  export let label = "button";
</script>

<button>{label}</button>`;

describe("glob-discovered module names are sanitized to valid identifiers", () => {
  let dir: string;
  let warn: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-glob-module-name-"));
    writeFileSync(path.join(dir, "3d-model.svelte"), BUTTON);
    writeFileSync(path.join(dir, "my.component.svelte"), BUTTON);
    writeFileSync(path.join(dir, "entry.js"), "");
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  test("strips invalid characters and prefixes a leading digit", async () => {
    const result = await generateBundle(path.join(dir, "entry.js"), true);

    expect(byModuleName(result.allComponentsForTypes, "_3dmodel")).toBeDefined();
    expect(byModuleName(result.allComponentsForTypes, "mycomponent")).toBeDefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"3dmodel" is not a valid identifier'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"my.component" is not a valid identifier'));
  });
});
