import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type ComponentDocApi, type ComponentDocs, generateBundle } from "../src/bundle";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions";

/** Look up `allComponentsForTypes` by filePath; moduleName is not unique. */
function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

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
});
