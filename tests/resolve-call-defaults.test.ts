import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type ComponentDocApi, type ComponentDocs, generateBundle } from "../src/bundle";

/** Look up `allComponentsForTypes` by filePath; moduleName is not unique. */
function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

const UNIQUE_ID_WITH_JSDOC = `/**
 * @param {string} [prefix]
 * @returns {string}
 */
export function uniqueId(prefix = "ccs") {
  return \`\${prefix}-\${Math.random().toString(36).slice(2)}\`;
}
`;

const UNIQUE_ID_NO_JSDOC = `export function uniqueId(prefix = "ccs") {
  return \`\${prefix}-\${Math.random().toString(36).slice(2)}\`;
}
`;

const UNIQUE_ID_DTS = `export function uniqueId(prefix?: string): string;
`;

const REEXPORT_BARREL = `export { uniqueId } from "./uniqueId.js";
`;

describe("cross-file CallExpression prop-default resolution", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-call-defaults-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("A: resolves a return type from a local .js export's JSDoc @returns", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "WithJsdoc.svelte"),
      `<script>
  import { uniqueId } from "./utils.js";

  /** Set an id for the input element */
  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as WithJsdoc } from "./WithJsdoc.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "WithJsdoc");
    const prop = component?.props.find((p) => p.name === "id");

    expect(prop?.type).toBe("string");
    expect(prop?.typeSource).toBe("typescript");
    expect(component?.diagnostics?.some((d) => d.name === "id")).toBe(false);
  });

  test("B: resolves a return type from a sibling .d.ts when the .js has no JSDoc", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_NO_JSDOC);
    writeFileSync(path.join(dir, "utils.d.ts"), UNIQUE_ID_DTS);
    writeFileSync(
      path.join(dir, "WithDts.svelte"),
      `<script>
  import { uniqueId } from "./utils.js";

  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as WithDts } from "./WithDts.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "WithDts");
    const prop = component?.props.find((p) => p.name === "id");

    expect(prop?.type).toBe("string");
    expect(prop?.typeSource).toBe("typescript");
  });

  test("resolves through a re-export barrel", async () => {
    writeFileSync(path.join(dir, "uniqueId.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(path.join(dir, "reexport.js"), REEXPORT_BARREL);
    writeFileSync(
      path.join(dir, "ViaReexport.svelte"),
      `<script>
  import { uniqueId } from "./reexport.js";

  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as ViaReexport } from "./ViaReexport.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "ViaReexport");
    const prop = component?.props.find((p) => p.name === "id");

    expect(prop?.type).toBe("string");
  });

  test("C: an explicit JSDoc @type on the prop wins over cross-file resolution", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "Explicit.svelte"),
      `<script>
  import { uniqueId } from "./utils.js";

  /** @type {"a" | "b"} */
  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Explicit } from "./Explicit.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "Explicit");
    const prop = component?.props.find((p) => p.name === "id");

    expect(prop?.type).toBe('"a" | "b"');
    expect(prop?.typeSource).toBe("jsdoc");
  });

  test("D: an unresolvable import falls back to any, never the literal string undefined", async () => {
    writeFileSync(
      path.join(dir, "Unresolvable.svelte"),
      `<script>
  import { uniqueId } from "./does-not-exist.js";

  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Unresolvable } from "./Unresolvable.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "Unresolvable");
    const prop = component?.props.find((p) => p.name === "id");

    expect(prop?.type).toBe("any");
    expect(prop?.typeSource).toBe("unknown");
    const diagnostic = component?.diagnostics?.find((d) => d.name === "id");
    expect(diagnostic?.message).toContain("could not be resolved");
  });

  test("D: an import that resolves but doesn't export the callee falls back to any", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "MissingExport.svelte"),
      `<script>
  import { notExported } from "./utils.js";

  export let id = notExported();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as MissingExport } from "./MissingExport.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "MissingExport");
    const prop = component?.props.find((p) => p.name === "id");

    expect(prop?.type).toBe("any");
    const diagnostic = component?.diagnostics?.find((d) => d.name === "id");
    expect(diagnostic?.message).toContain("is not exported from");
  });

  test("E: a same-file function default still resolves without any import", async () => {
    writeFileSync(
      path.join(dir, "SameFile.svelte"),
      `<script>
  function uniqueId() {
    return "x";
  }
  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as SameFile } from "./SameFile.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "SameFile");
    const prop = component?.props.find((p) => p.name === "id");

    expect(prop?.type).toBe("string");
  });
});
