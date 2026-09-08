/**
 * Manual validation step (not automated to avoid a runtime dependency on the
 * large `custom-elements-manifest` schema package): to validate a generated
 * `custom-elements.json` against the published schema, run
 *
 *   npx ajv-cli validate \
 *     -s https://unpkg.com/custom-elements-manifest/schema.json \
 *     -d custom-elements.json
 *
 * after enabling `customElements: true` in a project using sveld.
 */
import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import type { ComponentProp, ComponentSlot, SerializedComponentEvent } from "../src/ComponentParser";
import { setQuiet } from "../src/logger";
import type { ComponentDocs } from "../src/plugin";
import type { CemModule } from "../src/writer/writer-custom-elements";
import writeCustomElements, { renderCustomElementsManifest } from "../src/writer/writer-custom-elements";
import { mockComponentDocApi } from "./test-brands";

function mockProp(name: string, overrides?: Partial<ComponentProp>): ComponentProp {
  return {
    name,
    kind: "let",
    constant: false,
    isFunction: false,
    isFunctionDeclaration: false,
    isRequired: true,
    reactive: false,
    ...overrides,
  };
}

function mockEvent(name: string, overrides?: Partial<SerializedComponentEvent>): SerializedComponentEvent {
  return {
    type: "dispatched",
    name,
    ...overrides,
  } as SerializedComponentEvent;
}

function mockSlot(overrides?: Partial<ComponentSlot>): ComponentSlot {
  return {
    default: true,
    ...overrides,
  };
}

async function runWriter(components: ComponentDocs): Promise<{ module: CemModule; cleanup: () => void }> {
  const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-cem-"));
  const outFile = path.relative(process.cwd(), path.join(tempDir, "custom-elements.json"));

  await writeCustomElements(components, { inputDir: "src", outFile });

  const manifest = JSON.parse(readFileSync(path.join(tempDir, "custom-elements.json"), "utf-8"));
  return {
    module: manifest.modules[0],
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
  };
}

describe("writeCustomElements", () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setQuiet(false);
    jest.restoreAllMocks();
  });

  test("emits schemaVersion 1.0.0 and a javascript-module per component", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-cem-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "custom-elements.json"));
    const components: ComponentDocs = new Map([
      ["Zeta", mockComponentDocApi("Zeta", "Zeta.svelte")],
      ["Alpha", mockComponentDocApi("Alpha", "Alpha.svelte")],
    ]);

    try {
      await writeCustomElements(components, { inputDir: "src", outFile });
      const manifest = JSON.parse(readFileSync(path.join(tempDir, "custom-elements.json"), "utf-8"));

      expect(manifest.schemaVersion).toBe("1.0.0");
      // Deterministic ordering: sorted alphabetically by moduleName, same as the JSON writer.
      expect(manifest.modules.map((m: CemModule) => m.declarations[0].name)).toEqual(["Alpha", "Zeta"]);
      expect(manifest.modules[0].kind).toBe("javascript-module");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("prints the progress line to stderr", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-cem-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "custom-elements.json"));
    const components: ComponentDocs = new Map([["Alpha", mockComponentDocApi("Alpha", "Alpha.svelte")]]);

    try {
      await writeCustomElements(components, { inputDir: "src", outFile });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`created "${outFile}".`));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("logs unchanged on a second identical write", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-cem-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "custom-elements.json"));
    const components: ComponentDocs = new Map([["Alpha", mockComponentDocApi("Alpha", "Alpha.svelte")]]);

    try {
      await writeCustomElements(components, { inputDir: "src", outFile });
      errorSpy.mockClear();
      await writeCustomElements(components, { inputDir: "src", outFile });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`unchanged "${outFile}".`));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("suppresses the progress line when quiet mode is on", async () => {
    setQuiet(true);
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-cem-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "custom-elements.json"));
    const components: ComponentDocs = new Map([["Alpha", mockComponentDocApi("Alpha", "Alpha.svelte")]]);

    try {
      await writeCustomElements(components, { inputDir: "src", outFile });
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("renderCustomElementsManifest matches the document writeCustomElements writes to disk", async () => {
    const components: ComponentDocs = new Map([["Alpha", mockComponentDocApi("Alpha", "Alpha.svelte")]]);
    const rendered = renderCustomElementsManifest(components, { inputDir: "src" });

    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-cem-render-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "custom-elements.json"));

    try {
      await writeCustomElements(components, { inputDir: "src", outFile });
      const written = readFileSync(path.join(tempDir, "custom-elements.json"), "utf-8");

      expect(rendered).toBe(written);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("emits a plain class declaration when customElementTag is absent", async () => {
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0]).toMatchObject({
        kind: "class",
        name: "Button",
      });
      expect(module.declarations[0].tagName).toBeUndefined();
      expect(module.declarations[0].customElement).toBeUndefined();
      expect(module.exports).toEqual([
        { kind: "js", name: "Button", declaration: { name: "Button", module: module.path } },
      ]);
    } finally {
      cleanup();
    }
  });

  test("maps the custom-element tag name to tagName/customElement and adds the definition export", async () => {
    const components: ComponentDocs = new Map([
      ["Badge", mockComponentDocApi("Badge", "Badge.svelte", { customElementTag: "x-badge" })],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0]).toMatchObject({
        tagName: "x-badge",
        customElement: true,
      });
      expect(module.exports).toContainEqual({
        kind: "custom-element-definition",
        name: "x-badge",
        declaration: { name: "Badge", module: module.path },
      });
    } finally {
      cleanup();
    }
  });

  test("maps props to members, attributes, events, and slots", async () => {
    const components: ComponentDocs = new Map([
      [
        "Widget",
        mockComponentDocApi("Widget", "Widget.svelte", {
          customElementTag: "x-widget",
          props: [
            mockProp("label", { type: "string", value: '"hi"', description: "The label." }),
            mockProp("count", { type: "number" }),
            mockProp("data", { type: "Record<string, unknown>" }),
          ],
          events: [mockEvent("change", { detail: "string", description: "Fires on change." })],
          slots: [mockSlot(), mockSlot({ default: false, name: "footer", description: "Footer content." })],
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      const declaration = module.declarations[0];

      expect(declaration.members).toEqual([
        { kind: "field", name: "label", type: { text: "string" }, default: '"hi"', description: "The label." },
        { kind: "field", name: "count", type: { text: "number" } },
        { kind: "field", name: "data", type: { text: "Record<string, unknown>" } },
      ]);

      // Every prop becomes an attribute, including non-primitive types like "data";
      // Svelte's custom-element runtime observes an attribute for every prop.
      expect(declaration.attributes).toEqual([
        { name: "label", fieldName: "label", type: { text: "string" }, default: '"hi"', description: "The label." },
        { name: "count", fieldName: "count", type: { text: "number" } },
        { name: "data", fieldName: "data", type: { text: "Record<string, unknown>" } },
      ]);

      expect(declaration.events).toEqual([
        { name: "change", type: { text: "CustomEvent<string>" }, description: "Fires on change." },
      ]);

      expect(declaration.slots).toEqual([{ name: "" }, { name: "footer", description: "Footer content." }]);
    } finally {
      cleanup();
    }
  });

  test("keeps the first prop on an attribute-name collision and warns", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const components: ComponentDocs = new Map([
      [
        "Clash",
        mockComponentDocApi("Clash", "Clash.svelte", {
          props: [mockProp("value", { type: "string" }), mockProp("Value", { type: "string" })],
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].attributes).toEqual([
        { name: "value", fieldName: "value", type: { text: "string" } },
      ]);
      expect(module.declarations[0].members).toHaveLength(2);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"value" and "Value"'));
    } finally {
      cleanup();
    }
  });

  test("uses the customElement.props config for the attribute name, reflect, and JSON-typed props", async () => {
    const components: ComponentDocs = new Map([
      [
        "Themed",
        mockComponentDocApi("Themed", "Themed.svelte", {
          props: [
            mockProp("variant", { type: "string" }),
            mockProp("active", { type: "boolean" }),
            mockProp("tags", { type: "string[]", description: "The tags." }),
            mockProp("hidden", { type: "boolean" }),
          ],
          customElement: {
            props: {
              variant: { attribute: "data-variant" },
              active: { reflect: true },
              tags: { type: "Array" },
              hidden: { attribute: false },
            },
          },
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].attributes).toEqual([
        { name: "data-variant", fieldName: "variant", type: { text: "string" } },
        { name: "active", fieldName: "active", type: { text: "boolean" }, reflects: true },
        {
          name: "tags",
          fieldName: "tags",
          type: { text: "string[]" },
          description: "The tags. Serialized to/from JSON for the attribute.",
        },
      ]);
    } finally {
      cleanup();
    }
  });

  test("excludes export function accessors from attributes", async () => {
    const components: ComponentDocs = new Map([
      [
        "Accessor",
        mockComponentDocApi("Accessor", "Accessor.svelte", {
          props: [mockProp("getValue", { isFunctionDeclaration: true, isFunction: true })],
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].attributes).toEqual([]);
    } finally {
      cleanup();
    }
  });

  test("maps an export function accessor to a method, preferring JSDoc params/returns", async () => {
    const components: ComponentDocs = new Map([
      [
        "Notifier",
        mockComponentDocApi("Notifier", "Notifier.svelte", {
          props: [
            mockProp("add", {
              isFunctionDeclaration: true,
              isFunction: true,
              params: [{ name: "id", type: "string", description: "The id.", optional: false }],
              returnType: "boolean",
              description: "Adds a notification.",
            }),
          ],
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].members).toEqual([
        {
          kind: "method",
          name: "add",
          static: false,
          parameters: [{ name: "id", type: { text: "string" } }],
          return: { type: { text: "boolean" } },
          description: "Adds a notification.",
        },
      ]);
    } finally {
      cleanup();
    }
  });

  test("falls back to splitting the TS signature text when there's no JSDoc params/returns", async () => {
    const components: ComponentDocs = new Map([
      [
        "Calculator",
        mockComponentDocApi("Calculator", "Calculator.svelte", {
          props: [
            mockProp("add", {
              isFunctionDeclaration: true,
              isFunction: true,
              type: "(a: number, b?: number, ...rest: number[]) => number",
            }),
          ],
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].members).toEqual([
        {
          kind: "method",
          name: "add",
          static: false,
          parameters: [
            { name: "a", type: { text: "number" } },
            { name: "b", type: { text: "number" }, optional: true },
            { name: "rest", type: { text: "number[]" }, rest: true },
          ],
          return: { type: { text: "number" } },
        },
      ]);
    } finally {
      cleanup();
    }
  });

  test("marks an export const prop's field readonly", async () => {
    const components: ComponentDocs = new Map([
      [
        "Constant",
        mockComponentDocApi("Constant", "Constant.svelte", {
          props: [mockProp("version", { kind: "const", constant: true, type: "string", value: '"1.0.0"' })],
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].members).toEqual([
        { kind: "field", name: "version", type: { text: "string" }, default: '"1.0.0"', readonly: true },
      ]);
    } finally {
      cleanup();
    }
  });

  test("populates cssParts and cssProperties on the declaration when present", async () => {
    const components: ComponentDocs = new Map([
      [
        "Card",
        mockComponentDocApi("Card", "Card.svelte", {
          cssParts: [{ name: "header", description: "The header region." }],
          cssProperties: [
            { name: "--card-background", type: "Color", default: "white", description: "Card background." },
          ],
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].cssParts).toEqual([{ name: "header", description: "The header region." }]);
      expect(module.declarations[0].cssProperties).toEqual([
        { name: "--card-background", type: { text: "Color" }, default: "white", description: "Card background." },
      ]);
    } finally {
      cleanup();
    }
  });

  test("omits cssParts and cssProperties when absent", async () => {
    const components: ComponentDocs = new Map([["Plain", mockComponentDocApi("Plain", "Plain.svelte")]]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].cssParts).toBeUndefined();
      expect(module.declarations[0].cssProperties).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  test("excludes forwarded events; only dispatched (including $host) events are included", async () => {
    const components: ComponentDocs = new Map([
      [
        "Forwarder",
        mockComponentDocApi("Forwarder", "Forwarder.svelte", {
          events: [
            mockEvent("click", { type: "forwarded", element: "button" } as Partial<SerializedComponentEvent>),
            mockEvent("ready", { detail: "null" }),
          ],
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].events).toEqual([{ name: "ready", type: { text: "CustomEvent<null>" } }]);
    } finally {
      cleanup();
    }
  });

  test("carries a deprecated prop's deprecation onto its member and attribute", async () => {
    const components: ComponentDocs = new Map([
      [
        "Old",
        mockComponentDocApi("Old", "Old.svelte", {
          props: [mockProp("legacy", { type: "string", deprecated: "Use `modern` instead." })],
        }),
      ],
    ]);
    const { module, cleanup } = await runWriter(components);

    try {
      expect(module.declarations[0].members[0]).toMatchObject({
        deprecated: "Use `modern` instead.",
      });
    } finally {
      cleanup();
    }
  });
});
