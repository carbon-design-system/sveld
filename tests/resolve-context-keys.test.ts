import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

  test("exported components carry the resolved context for JSON and Markdown", async () => {
    mkdirSync(path.join(dir, "constants"));
    mkdirSync(path.join(dir, "FluidForm"));
    writeFileSync(path.join(dir, "constants", "context-keys.ts"), `export const FORM_CONTEXT_KEY = "carbon:Form";\n`);
    writeFileSync(
      path.join(dir, "FluidForm", "FluidForm.svelte"),
      `<script>
  import { setContext } from "svelte";
  import { FORM_CONTEXT_KEY } from "../constants/context-keys";

  setContext(FORM_CONTEXT_KEY, { isFluid: true });
</script>
<form><slot /></form>
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as FluidForm } from "./FluidForm/FluidForm.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);

    for (const components of [result.components, result.allComponentsForTypes]) {
      const component = byModuleName(components, "FluidForm");
      expect(component?.contexts).toMatchObject([
        { key: "carbon:Form", typeName: "CarbonFormContext", properties: [{ name: "isFluid", type: "boolean" }] },
      ]);
    }
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

  test("C: export let stays unresolved and records a diagnostic", async () => {
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
    expect(result.diagnostics.filter((d) => d.kind === "context-key-unresolved")).toMatchObject([
      { code: "sveld/context-key-unresolved", name: "MODAL_KEY", source: { start: { line: 7 } } },
    ]);
  });

  test("missing export records a diagnostic and skips the context", async () => {
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
    expect(result.diagnostics.filter((d) => d.kind === "context-key-unresolved")).toMatchObject([
      { name: "MODAL_KEY" },
    ]);
  });

  test("missing module records a diagnostic and skips the context", async () => {
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
    expect(result.diagnostics.filter((d) => d.kind === "context-key-unresolved")).toMatchObject([
      { name: "MODAL_KEY" },
    ]);
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
