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

  test("F: import after the export let (carbon-components-svelte props-then-imports style)", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "ImportAfter.svelte"),
      `<script>
  export let id = uniqueId();

  import { uniqueId } from "./utils.js";
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as ImportAfter } from "./ImportAfter.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "ImportAfter");
    const prop = component?.props.find((p) => p.name === "id");

    expect(prop?.type).toBe("string");
    expect(component?.diagnostics?.some((d) => d.name === "id")).toBe(false);
  });

  test("F: a late import among other imports still resolves", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "LateAmongOthers.svelte"),
      `<script>
  export let label = "";
  export let id = uniqueId();
  import { createEventDispatcher } from "svelte";
  import { uniqueId } from "./utils.js";
</script>
<div {id} />
`,
    );
    writeFileSync(
      path.join(dir, "index.js"),
      `export { default as LateAmongOthers } from "./LateAmongOthers.svelte";\n`,
    );

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "LateAmongOthers")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("string");
  });

  test("F: a renamed import after the export let still resolves via importedName", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "RenamedAfter.svelte"),
      `<script>
  export let id = makeId();

  import { uniqueId as makeId } from "./utils.js";
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as RenamedAfter } from "./RenamedAfter.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "RenamedAfter")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("string");
  });

  test("F: an import after the export let that cannot be resolved still falls back to any", async () => {
    writeFileSync(
      path.join(dir, "Unresolvable2.svelte"),
      `<script>
  export let id = uniqueId();

  import { uniqueId } from "./does-not-exist.js";
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Unresolvable2 } from "./Unresolvable2.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "Unresolvable2")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("any");
  });

  test("F: explicit JSDoc @type still wins when the import comes after the export let", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "ExplicitAfter.svelte"),
      `<script>
  /** @type {"a" | "b"} */
  export let id = uniqueId();

  import { uniqueId } from "./utils.js";
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as ExplicitAfter } from "./ExplicitAfter.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "ExplicitAfter")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe('"a" | "b"');
    expect(prop?.typeSource).toBe("jsdoc");
  });

  test("F: a same-file function declared after the export let still resolves", async () => {
    writeFileSync(
      path.join(dir, "SameFileAfter.svelte"),
      `<script>
  export let id = uniqueId();

  function uniqueId() {
    return "x";
  }
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as SameFileAfter } from "./SameFileAfter.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "SameFileAfter")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("string");
  });

  test("fully cached second run still resolves import call defaults", async () => {
    const cacheFile = path.join(dir, "parse-cache.json");
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "Cached.svelte"),
      `<script>
  import { uniqueId } from "./utils.js";
  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Cached } from "./Cached.svelte";\n`);

    const first = await generateBundle(path.join(dir, "index.js"), true, { cache: cacheFile });
    expect(byModuleName(first.allComponentsForTypes, "Cached")?.props.find((p) => p.name === "id")?.type).toBe(
      "string",
    );

    // Warm cache: still need the parser stack for the call-default pass.
    const second = await generateBundle(path.join(dir, "index.js"), true, { cache: cacheFile });
    const prop = byModuleName(second.allComponentsForTypes, "Cached")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("string");
  });

  test("module-script named import resolves an instance CallExpression default", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "ModuleImport.svelte"),
      `<script context="module">
  import { uniqueId } from "./utils.js";
</script>
<script>
  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as ModuleImport } from "./ModuleImport.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "ModuleImport")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("string");
  });

  test("same-file const arrow callee resolves via literal return", async () => {
    writeFileSync(
      path.join(dir, "ConstArrow.svelte"),
      `<script>
  const uniqueId = () => "x";
  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as ConstArrow } from "./ConstArrow.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "ConstArrow")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("string");
    expect(prop?.returnType).toBeUndefined();
  });

  test("renamed named import resolves via importedName", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_WITH_JSDOC);
    writeFileSync(
      path.join(dir, "Renamed.svelte"),
      `<script>
  import { uniqueId as makeId } from "./utils.js";
  export let id = makeId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as Renamed } from "./Renamed.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "Renamed")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("string");
  });

  test("cross-file function without JSDoc/.d.ts still infers a literal return", async () => {
    writeFileSync(path.join(dir, "utils.js"), UNIQUE_ID_NO_JSDOC);
    writeFileSync(
      path.join(dir, "BodyInfer.svelte"),
      `<script>
  import { uniqueId } from "./utils.js";
  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as BodyInfer } from "./BodyInfer.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "BodyInfer")?.props.find((p) => p.name === "id");
    // Template return → string via cross-file literal inference.
    expect(prop?.type).toBe("string");
  });

  test("binding-annotated const export supplies returnType for call defaults", async () => {
    writeFileSync(path.join(dir, "utils.ts"), `export const uniqueId: () => string = () => "x";\n`);
    writeFileSync(
      path.join(dir, "BindingType.svelte"),
      `<script lang="ts">
  import { uniqueId } from "./utils";
  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as BindingType } from "./BindingType.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const prop = byModuleName(result.allComponentsForTypes, "BindingType")?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("string");
  });

  test("export found but no resolvable return type falls back to any", async () => {
    writeFileSync(
      path.join(dir, "utils.js"),
      `export function uniqueId(prefix = "ccs") {
  return Math.random();
}
`,
    );
    writeFileSync(
      path.join(dir, "NoReturn.svelte"),
      `<script>
  import { uniqueId } from "./utils.js";
  export let id = uniqueId();
</script>
<div {id} />
`,
    );
    writeFileSync(path.join(dir, "index.js"), `export { default as NoReturn } from "./NoReturn.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);
    const component = byModuleName(result.allComponentsForTypes, "NoReturn");
    const prop = component?.props.find((p) => p.name === "id");
    expect(prop?.type).toBe("any");
    expect(component?.diagnostics?.find((d) => d.name === "id")?.message).toContain(
      "return type could not be resolved",
    );
  });
});
