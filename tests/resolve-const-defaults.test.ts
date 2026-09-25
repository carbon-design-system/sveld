import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type ComponentDocApi, type ComponentDocs, generateBundle } from "../src/bundle";
import { setQuiet } from "../src/logger";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions";

/** Look up `allComponentsForTypes` by filePath; moduleName is not unique. */
function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

/** The warning names the module and the error's position in the module itself. */
const PARSE_WARNING_AT_LINE_2_REGEX = /broken\.js to read its exports \(.*\(2:13\)\)/;

const TIMING = `/** Tooltip leave delay. */
export const TOOLTIP_LEAVE_DELAY_MS = 300;
export const OFFSET = -4;
export const LABEL = "Close";
export const TEMPLATE_LABEL = \`Open\`;
export const ENABLED = true;
export let MUTABLE_DELAY = 100;
export const COMPUTED_DELAY = TOOLTIP_LEAVE_DELAY_MS * 2;
`;

describe("cross-file imported-constant prop-default resolution", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-const-defaults-"));
    writeFileSync(path.join(dir, "timing.js"), TIMING);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  async function parseComponent(name: string, source: string): Promise<ComponentDocApi | undefined> {
    writeFileSync(path.join(dir, `${name}.svelte`), source);
    writeFileSync(path.join(dir, "index.js"), `export { default as ${name} } from "./${name}.svelte";\n`);
    const result = await generateBundle(path.join(dir, "index.js"), true);
    return byModuleName(result.allComponentsForTypes, name);
  }

  test("replaces an imported primitive const with its literal and types the prop", async () => {
    const component = await parseComponent(
      "Tooltip",
      `<script>
  import { TOOLTIP_LEAVE_DELAY_MS, OFFSET, LABEL as CLOSE_LABEL, TEMPLATE_LABEL, ENABLED } from "./timing.js";

  /** Delay before hiding, in ms */
  export let leaveDelayMs = TOOLTIP_LEAVE_DELAY_MS;
  export let offset = OFFSET;
  export let label = CLOSE_LABEL;
  export let openLabel = TEMPLATE_LABEL;
  export let enabled = ENABLED;
</script>
<div />
`,
    );

    const pick = (name: string) => {
      const prop = component?.props.find((p) => p.name === name);
      return { type: prop?.type, typeSource: prop?.typeSource, value: prop?.value, defaultValue: prop?.defaultValue };
    };

    expect(pick("leaveDelayMs")).toEqual({
      type: "number",
      typeSource: "default",
      value: "300",
      defaultValue: { raw: "300", kind: "literal", value: 300 },
    });
    expect(pick("offset")).toEqual({
      type: "number",
      typeSource: "default",
      value: "-4",
      defaultValue: { raw: "-4", kind: "literal", value: -4 },
    });
    expect(pick("label")).toEqual({
      type: "string",
      typeSource: "default",
      value: '"Close"',
      defaultValue: { raw: '"Close"', kind: "literal", value: "Close" },
    });
    expect(pick("openLabel")).toEqual({
      type: "string",
      typeSource: "default",
      value: "`Open`",
      defaultValue: { raw: "`Open`", kind: "literal", value: "Open" },
    });
    expect(pick("enabled")).toEqual({
      type: "boolean",
      typeSource: "default",
      value: "true",
      defaultValue: { raw: "true", kind: "literal", value: true },
    });
    expect(component?.diagnostics ?? []).toEqual([]);

    const dts = writeTsDefinition(component as ComponentDocApi);
    expect(dts).toContain("@default 300");
    expect(dts).toContain("leaveDelayMs?: number;");
  });

  test("resolves a runes prop default", async () => {
    const component = await parseComponent(
      "RunesTooltip",
      `<script>
  import { TOOLTIP_LEAVE_DELAY_MS } from "./timing.js";

  let { leaveDelayMs = TOOLTIP_LEAVE_DELAY_MS } = $props();
</script>
<div />
`,
    );
    const prop = component?.props.find((p) => p.name === "leaveDelayMs");

    expect(prop?.type).toBe("number");
    expect(prop?.value).toBe("300");
  });

  test("resolves through a re-export barrel", async () => {
    writeFileSync(path.join(dir, "constants.js"), `export { TOOLTIP_LEAVE_DELAY_MS } from "./timing.js";\n`);
    const component = await parseComponent(
      "Barrel",
      `<script>
  import { TOOLTIP_LEAVE_DELAY_MS } from "./constants.js";

  export let leaveDelayMs = TOOLTIP_LEAVE_DELAY_MS;
</script>
<div />
`,
    );

    expect(component?.props.find((p) => p.name === "leaveDelayMs")?.value).toBe("300");
  });

  test("an explicit JSDoc @type keeps its type; the default still resolves", async () => {
    const component = await parseComponent(
      "Typed",
      `<script>
  import { TOOLTIP_LEAVE_DELAY_MS } from "./timing.js";

  /** @type {100 | 300 | 500} */
  export let leaveDelayMs = TOOLTIP_LEAVE_DELAY_MS;
</script>
<div />
`,
    );
    const prop = component?.props.find((p) => p.name === "leaveDelayMs");

    expect(prop?.type).toBe("100 | 300 | 500");
    expect(prop?.typeSource).toBe("jsdoc");
    expect(prop?.value).toBe("300");
  });

  test("leaves let exports, non-literal consts, and missing modules unresolved", async () => {
    const component = await parseComponent(
      "Unresolved",
      `<script>
  import { MUTABLE_DELAY, COMPUTED_DELAY, NOT_EXPORTED } from "./timing.js";
  import { MISSING } from "./does-not-exist.js";

  export let mutable = MUTABLE_DELAY;
  export let computed = COMPUTED_DELAY;
  export let notExported = NOT_EXPORTED;
  export let missing = MISSING;
</script>
<div />
`,
    );

    for (const [name, raw] of [
      ["mutable", "MUTABLE_DELAY"],
      ["computed", "COMPUTED_DELAY"],
      ["notExported", "NOT_EXPORTED"],
      ["missing", "MISSING"],
    ]) {
      const prop = component?.props.find((p) => p.name === name);
      expect(prop?.value).toBe(raw);
      expect(prop?.typeSource).toBe("unknown");
      expect(prop?.defaultValue).toEqual({ raw, kind: "expression" });
      expect(component?.diagnostics?.some((d) => d.kind === "prop-unknown-type" && d.name === name)).toBe(true);
    }
  });

  test("resolves a default read off a namespace import, through `export * as` chains", async () => {
    writeFileSync(path.join(dir, "constants.js"), 'export * as timing from "./timing.js";\n');
    const component = await parseComponent(
      "Namespaced",
      `<script>
  import * as C from "./timing.js";
  import * as constants from "./constants.js";

  export let delay = C.TOOLTIP_LEAVE_DELAY_MS;
  export let label = constants.timing.LABEL;
  export let mutable = C.MUTABLE_DELAY;
</script>
<div />
`,
    );
    const runes = await parseComponent(
      "RunesNamespaced",
      `<script>
  import * as C from "./timing.js";

  let { delay = C.TOOLTIP_LEAVE_DELAY_MS } = $props();
</script>
<div />
`,
    );

    const pick = (name: string) => {
      const prop = component?.props.find((p) => p.name === name);
      return { type: prop?.type, value: prop?.value, defaultValue: prop?.defaultValue };
    };
    expect(pick("delay")).toEqual({
      type: "number",
      value: "300",
      defaultValue: { raw: "300", kind: "literal", value: 300 },
    });
    expect(pick("label")).toEqual({
      type: "string",
      value: '"Close"',
      defaultValue: { raw: '"Close"', kind: "literal", value: "Close" },
    });
    expect(pick("mutable").value).toBe("C.MUTABLE_DELAY");
    expect(component?.diagnostics?.map((d) => [d.kind, d.name])).toEqual([["prop-unknown-type", "mutable"]]);
    expect(runes?.props.find((p) => p.name === "delay")).toMatchObject({ type: "number", value: "300" });
  });

  test("resolves a module-script export const", async () => {
    const component = await parseComponent(
      "ModuleConst",
      `<script context="module">
  import { TOOLTIP_LEAVE_DELAY_MS } from "./timing.js";

  export const DEFAULT_DELAY = TOOLTIP_LEAVE_DELAY_MS;
</script>
<div />
`,
    );
    const moduleExport = component?.moduleExports.find((e) => e.name === "DEFAULT_DELAY");

    expect(moduleExport?.value).toBe("300");
    expect(moduleExport?.type).toBe("number");
  });

  test("resolves a module-script const exported under another name", async () => {
    const component = await parseComponent(
      "ModuleRenamed",
      `<script context="module">
  import { TOOLTIP_LEAVE_DELAY_MS } from "./timing.js";

  const delay = TOOLTIP_LEAVE_DELAY_MS;
  export { delay as DEFAULT_DELAY };
</script>
<div />
`,
    );
    const moduleExport = component?.moduleExports.find((e) => e.name === "DEFAULT_DELAY");

    expect(moduleExport?.value).toBe("300");
    expect(moduleExport?.type).toBe("number");
  });

  test("resolves each component the same whichever order an import cycle is reached in", async () => {
    writeFileSync(path.join(dir, "a.js"), 'export const X = 1;\nexport * from "./b.js";\n');
    writeFileSync(path.join(dir, "b.js"), 'export * from "./a.js";\nexport const Y = 2;\n');
    writeFileSync(
      path.join(dir, "One.svelte"),
      '<script>\n  import { X } from "./a.js";\n  export let x = X;\n</script>\n',
    );
    writeFileSync(
      path.join(dir, "Two.svelte"),
      '<script>\n  import { X } from "./b.js";\n  export let x = X;\n</script>\n',
    );

    const valuesInOrder = async (order: string[]) => {
      writeFileSync(
        path.join(dir, "index.js"),
        order.map((name) => `export { default as ${name} } from "./${name}.svelte";\n`).join(""),
      );
      const result = await generateBundle(path.join(dir, "index.js"), false, { cache: false });
      return order.map((name) => result.components.get(name)?.props[0]?.value);
    };

    expect(await valuesInOrder(["One", "Two"])).toEqual(["1", "1"]);
    expect(await valuesInOrder(["Two", "One"])).toEqual(["1", "1"]);
  });

  test("reads `as const` and `satisfies` initializers, and types the prop from a portable declared type", async () => {
    writeFileSync(
      path.join(dir, "typed.ts"),
      [
        'export type Size = "sm" | "md";',
        'export const CAST = "x" as const;',
        'export const CHECKED = "y" satisfies string;',
        'export const ANNOTATED: "sm" | "md" = "md";',
        'export const NAMED: Size = "sm";',
        '/** @type {"a" | "b"} */',
        'export const JSDOC = "a";',
        "",
      ].join("\n"),
    );

    const component = await parseComponent(
      "Typed",
      `<script>
  import { CAST, CHECKED, ANNOTATED, NAMED, JSDOC } from "./typed";
  export let cast = CAST;
  export let checked = CHECKED;
  export let annotated = ANNOTATED;
  export let named = NAMED;
  export let jsdoc = JSDOC;
</script>
`,
    );

    expect(component?.props.map((prop) => [prop.name, prop.value, prop.type, prop.typeSource])).toEqual([
      ["cast", '"x"', "string", "default"],
      ["checked", '"y"', "string", "default"],
      ["annotated", '"md"', '"sm" | "md"', "typescript"],
      // `Size` isn't in scope in the component's .d.ts.
      ["named", '"sm"', "string", "default"],
      ["jsdoc", '"a"', '"a" | "b"', "jsdoc"],
    ]);
  });

  test("reads a module with `</script>` in a string or a `#!` first line", async () => {
    writeFileSync(path.join(dir, "html.js"), 'export const SNIPPET = "<script>alert(1)</script>";\n');
    writeFileSync(path.join(dir, "cli.js"), "#!/usr/bin/env node\nexport const DELAY = 300;\n");

    const component = await parseComponent(
      "Scripty",
      `<script>
  import { SNIPPET } from "./html.js";
  import { DELAY } from "./cli.js";
  export let snippet = SNIPPET;
  export let delay = DELAY;
</script>
`,
    );

    expect(component?.props.map((prop) => [prop.name, prop.value])).toEqual([
      ["snippet", '"<script>alert(1)</script>"'],
      ["delay", "300"],
    ]);
  });

  test("reads an export const from a .svelte file's module script", async () => {
    writeFileSync(
      path.join(dir, "Sizes.svelte"),
      '<script context="module">\n  export const DEFAULT_SIZE = "md";\n</script>\n\n<div />\n',
    );

    const component = await parseComponent(
      "Sized",
      '<script>\n  import { DEFAULT_SIZE } from "./Sizes.svelte";\n  export let size = DEFAULT_SIZE;\n</script>\n',
    );

    expect(component?.props[0]).toMatchObject({ value: '"md"', type: "string" });
  });

  test("warns through the quiet-aware logger, with the module's own line numbers", async () => {
    writeFileSync(path.join(dir, "broken.js"), "export const OK = 1;\nexport const = 2;\n");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const source = '<script>\n  import { OK } from "./broken.js";\n  export let ok = OK;\n</script>\n';
      await parseComponent("Broken", source);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(PARSE_WARNING_AT_LINE_2_REGEX));

      errorSpy.mockClear();
      setQuiet(true);
      await parseComponent("Broken", source);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      setQuiet(false);
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  test("a module's own export beats an `export *` of the same name, in either order", async () => {
    writeFileSync(path.join(dir, "a.js"), "export const DELAY = 1;\n");
    writeFileSync(path.join(dir, "before.js"), 'export * from "./a.js";\nexport const DELAY = 2;\n');
    writeFileSync(path.join(dir, "after.js"), 'export const DELAY = 3;\nexport * from "./a.js";\n');

    const before = await parseComponent(
      "Before",
      '<script>\n  import { DELAY } from "./before.js";\n  export let delay = DELAY;\n</script>\n',
    );
    const after = await parseComponent(
      "After",
      '<script>\n  import { DELAY } from "./after.js";\n  export let delay = DELAY;\n</script>\n',
    );

    expect(before?.props[0]?.value).toBe("2");
    expect(after?.props[0]?.value).toBe("3");
  });

  test("a name two `export *` statements bring in from different modules stays unresolved", async () => {
    writeFileSync(path.join(dir, "a.js"), "export const DELAY = 1;\nexport const SHARED = 5;\n");
    writeFileSync(path.join(dir, "b.js"), "export const DELAY = 2;\n");
    writeFileSync(path.join(dir, "shared.js"), 'export * from "./a.js";\n');
    writeFileSync(
      path.join(dir, "consts.js"),
      'export * from "./a.js";\nexport * from "./b.js";\nexport * from "./shared.js";\n',
    );

    const component = await parseComponent(
      "Ambiguous",
      `<script>
  import { DELAY, SHARED } from "./consts.js";
  export let delay = DELAY;
  export let shared = SHARED;
</script>
`,
    );

    const delay = component?.props.find((prop) => prop.name === "delay");
    expect(delay?.value).toBe("DELAY");
    expect(delay?.typeSource).toBe("unknown");
    // Two paths to the same declaration aren't ambiguous.
    expect(component?.props.find((prop) => prop.name === "shared")?.value).toBe("5");
  });
});
