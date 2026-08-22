import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type ComponentDocApi, type ComponentDocs, generateBundle } from "../src/bundle";

/** Look up `allComponentsForTypes` by filePath; moduleName is not unique. */
function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

describe("cross-file setContext key resolution", () => {
  let dir: string;
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-context-keys-"));
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  test("A: resolves a setContext key imported from a plain .js module", async () => {
    writeFileSync(
      path.join(dir, "highlightCursor.js"),
      `export const HIGHLIGHT_CURSOR_KEY = "carbon:ListBoxHighlight";\n`,
    );
    writeFileSync(
      path.join(dir, "ListBoxMenu.svelte"),
      `<script>
  import { setContext } from "svelte";
  import { HIGHLIGHT_CURSOR_KEY } from "./highlightCursor.js";

  /** @type {number} */
  let highlightCursor = 0;

  setContext(HIGHLIGHT_CURSOR_KEY, { highlightCursor });
</script>
<div><slot /></div>
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as ListBoxMenu } from "./ListBoxMenu.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "ListBoxMenu");

    expect(component?.contexts).toHaveLength(1);
    expect(component?.contexts?.[0]).toMatchObject({
      key: "carbon:ListBoxHighlight",
      typeName: "CarbonListBoxHighlightContext",
    });
    expect(component?.contexts?.[0].properties).toMatchObject([
      { name: "highlightCursor", type: "number", optional: false },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("B: resolves through a re-export barrel", async () => {
    writeFileSync(path.join(dir, "key.js"), `export const MODAL_KEY = "simple-modal";\n`);
    writeFileSync(path.join(dir, "reexport.js"), `export { MODAL_KEY } from "./key.js";\n`);
    writeFileSync(
      path.join(dir, "Modal.svelte"),
      `<script>
  import { setContext } from "svelte";
  import { MODAL_KEY } from "./reexport.js";

  const close = () => {};

  setContext(MODAL_KEY, { close });
</script>
<div><slot /></div>
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Modal } from "./Modal.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "Modal");

    expect(component?.contexts).toHaveLength(1);
    expect(component?.contexts?.[0].key).toBe("simple-modal");
  });

  test("C: export let stays unresolved and warns", async () => {
    writeFileSync(path.join(dir, "key.js"), `export let MODAL_KEY = "simple-modal";\n`);
    writeFileSync(
      path.join(dir, "Modal.svelte"),
      `<script>
  import { setContext } from "svelte";
  import { MODAL_KEY } from "./key.js";

  const close = () => {};

  setContext(MODAL_KEY, { close });
</script>
<div><slot /></div>
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Modal } from "./Modal.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "Modal");

    expect(component?.contexts ?? []).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not resolve setContext key"));
  });

  test("missing export warns and skips the context", async () => {
    writeFileSync(path.join(dir, "key.js"), `export const OTHER_KEY = "other";\n`);
    writeFileSync(
      path.join(dir, "Modal.svelte"),
      `<script>
  import { setContext } from "svelte";
  import { MODAL_KEY } from "./key.js";

  const close = () => {};

  setContext(MODAL_KEY, { close });
</script>
<div><slot /></div>
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Modal } from "./Modal.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "Modal");

    expect(component?.contexts ?? []).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  test("missing module warns and skips the context", async () => {
    writeFileSync(
      path.join(dir, "Modal.svelte"),
      `<script>
  import { setContext } from "svelte";
  import { MODAL_KEY } from "./does-not-exist.js";

  const close = () => {};

  setContext(MODAL_KEY, { close });
</script>
<div><slot /></div>
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Modal } from "./Modal.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "Modal");

    expect(component?.contexts ?? []).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  test("renamed import uses importedName", async () => {
    writeFileSync(path.join(dir, "key.js"), `export const MODAL_KEY = "simple-modal";\n`);
    writeFileSync(
      path.join(dir, "Modal.svelte"),
      `<script>
  import { setContext } from "svelte";
  import { MODAL_KEY as KEY } from "./key.js";

  const close = () => {};

  setContext(KEY, { close });
</script>
<div><slot /></div>
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Modal } from "./Modal.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "Modal");

    expect(component?.contexts?.[0]?.key).toBe("simple-modal");
  });

  test("local const resolves without an import", async () => {
    writeFileSync(
      path.join(dir, "Modal.svelte"),
      `<script>
  import { setContext } from "svelte";

  const MODAL_KEY = "simple-modal";
  const close = () => {};

  setContext(MODAL_KEY, { close });
</script>
<div><slot /></div>
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Modal } from "./Modal.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "Modal");

    expect(component?.contexts?.[0]?.key).toBe("simple-modal");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
