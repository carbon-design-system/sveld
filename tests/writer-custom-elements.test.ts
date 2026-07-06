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
import type { ComponentDocs } from "../src/plugin";
import type { CemModule } from "../src/writer/writer-custom-elements";
import writeCustomElements from "../src/writer/writer-custom-elements";
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
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
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

      // Only bare primitive-typed props become attributes; "data" is skipped.
      expect(declaration.attributes).toEqual([
        { name: "label", fieldName: "label", type: { text: "string" }, default: '"hi"', description: "The label." },
        { name: "count", fieldName: "count", type: { text: "number" } },
      ]);

      expect(declaration.events).toEqual([
        { name: "change", type: { text: "CustomEvent<string>" }, description: "Fires on change." },
      ]);

      expect(declaration.slots).toEqual([{ name: "" }, { name: "footer", description: "Footer content." }]);
    } finally {
      cleanup();
    }
  });

  test("drops attributes that collide on the same lowercased name", async () => {
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
      expect(module.declarations[0].attributes).toEqual([]);
      expect(module.declarations[0].members).toHaveLength(2);
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
