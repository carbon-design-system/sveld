import { rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { version as svelteVersion } from "svelte/package.json";
import { name as packageName, version as packageVersion } from "../package.json";
import { diffApiDocuments, formatCheckReport, formatCheckReportJson, runCheck } from "../src/check";
import type { ComponentDocApi, ComponentDocs } from "../src/plugin";
import type { ComponentApiDocument } from "../src/writer/document-model";
import { mockComponentDocApi } from "./test-brands";

function makeProp(
  name: string,
  overrides?: Partial<ComponentDocApi["props"][number]>,
): ComponentDocApi["props"][number] {
  return {
    name,
    kind: "let",
    constant: false,
    isFunction: false,
    isFunctionDeclaration: false,
    isRequired: false,
    reactive: false,
    ...overrides,
  };
}

function document(components: ComponentDocApi[]): ComponentApiDocument {
  return {
    schemaVersion: 1,
    generator: { name: packageName, version: packageVersion, svelteVersion },
    total: components.length,
    components,
  };
}

describe("diffApiDocuments", () => {
  test("no changes when both documents are identical", () => {
    const button = mockComponentDocApi("Button", "Button.svelte", { props: [makeProp("label", { type: "string" })] });
    expect(diffApiDocuments(document([button]), document([button]))).toEqual([]);
  });

  test("flags an added component as additive", () => {
    const button = mockComponentDocApi("Button", "Button.svelte");
    const changes = diffApiDocuments(document([]), document([button]));

    expect(changes).toEqual([
      { component: "Button", kind: "component", bump: "minor", message: 'component "Button" added' },
    ]);
  });

  test("flags a removed component as breaking", () => {
    const button = mockComponentDocApi("Button", "Button.svelte");
    const changes = diffApiDocuments(document([button]), document([]));

    expect(changes).toEqual([
      { component: "Button", kind: "component", bump: "major", message: 'component "Button" removed' },
    ]);
  });

  describe("props", () => {
    test("an added optional prop is additive", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", { props: [] });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("icon", { isRequired: false })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([
        { component: "Button", kind: "prop", name: "icon", bump: "minor", message: 'prop "icon" added' },
      ]);
    });

    test("an added required prop is breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", { props: [] });
      const after = mockComponentDocApi("Button", "Button.svelte", { props: [makeProp("href", { isRequired: true })] });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([
        { component: "Button", kind: "prop", name: "href", bump: "major", message: 'prop "href" added (required)' },
      ]);
    });

    test("a removed prop is breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", { props: [makeProp("legacy")] });
      const after = mockComponentDocApi("Button", "Button.svelte", { props: [] });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([
        { component: "Button", kind: "prop", name: "legacy", bump: "major", message: 'prop "legacy" removed' },
      ]);
    });

    test("a prop becoming required is breaking; becoming optional is additive", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("href", { isRequired: false }), makeProp("target", { isRequired: true })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("href", { isRequired: true }), makeProp("target", { isRequired: false })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toContainEqual({
        component: "Button",
        kind: "prop",
        name: "href",
        bump: "major",
        message: 'prop "href" became required',
      });
      expect(changes).toContainEqual({
        component: "Button",
        kind: "prop",
        name: "target",
        bump: "minor",
        message: 'prop "target" became optional',
      });
    });

    test("widening a union type is additive", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("variant", { type: '"primary"' })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("variant", { type: '"primary" | "secondary"' })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([
        {
          component: "Button",
          kind: "prop",
          name: "variant",
          bump: "minor",
          message: 'prop "variant" type changed from `"primary"` to `"primary" | "secondary"`',
        },
      ]);
    });

    test("narrowing a union type is breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("variant", { type: '"primary" | "secondary"' })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("variant", { type: '"primary"' })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ bump: "major" });
    });

    test("an unrelated type change is breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", { props: [makeProp("value", { type: "string" })] });
      const after = mockComponentDocApi("Button", "Button.svelte", { props: [makeProp("value", { type: "number" })] });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ bump: "major" });
    });

    test("a description-only change is not reported", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("value", { type: "string", description: "old" })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("value", { type: "string", description: "new" })],
      });

      expect(diffApiDocuments(document([before]), document([after]))).toEqual([]);
    });
  });

  describe("events", () => {
    test("added/removed events are additive/breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        events: [{ type: "dispatched", name: "close", detail: "null" }],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        events: [{ type: "dispatched", name: "open", detail: "null" }],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toContainEqual({
        component: "Button",
        kind: "event",
        name: "open",
        bump: "minor",
        message: 'event "open" added',
      });
      expect(changes).toContainEqual({
        component: "Button",
        kind: "event",
        name: "close",
        bump: "major",
        message: 'event "close" removed',
      });
    });

    test("a narrowed dispatched detail type is breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        events: [{ type: "dispatched", name: "change", detail: "string | number" }],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        events: [{ type: "dispatched", name: "change", detail: "string" }],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ kind: "event", name: "change", bump: "major" });
    });
  });

  describe("slots", () => {
    test("added/removed slots are additive/breaking", () => {
      const before = mockComponentDocApi("Card", "Card.svelte", { slots: [{ name: "header", default: false }] });
      const after = mockComponentDocApi("Card", "Card.svelte", { slots: [{ name: "footer", default: false }] });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toContainEqual({
        component: "Card",
        kind: "slot",
        name: "footer",
        bump: "minor",
        message: 'slot "footer" added',
      });
      expect(changes).toContainEqual({
        component: "Card",
        kind: "slot",
        name: "header",
        bump: "major",
        message: 'slot "header" removed',
      });
    });

    test("a narrowed slot_props type is breaking", () => {
      const before = mockComponentDocApi("Card", "Card.svelte", {
        slots: [{ name: null, default: true, slot_props: "{ title: string; subtitle: string }" }],
      });
      const after = mockComponentDocApi("Card", "Card.svelte", {
        slots: [{ name: null, default: true, slot_props: "{ title: string }" }],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ kind: "slot", name: "default", bump: "major" });
    });
  });

  describe("shape fields", () => {
    test("a generics change is breaking", () => {
      const before = mockComponentDocApi("List", "List.svelte", { generics: ["T", "string"] });
      const after = mockComponentDocApi("List", "List.svelte", { generics: ["T", "number"] });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([
        {
          component: "List",
          kind: "shape",
          name: "generics",
          bump: "major",
          message: '"generics" changed (breaking)',
        },
      ]);
    });

    test("a description-only context change is not reported", () => {
      const before = mockComponentDocApi("Tabs", "Tabs.svelte", {
        contexts: [{ key: "tabs", typeName: "TabsContext", description: "old", properties: [] }],
      });
      const after = mockComponentDocApi("Tabs", "Tabs.svelte", {
        contexts: [{ key: "tabs", typeName: "TabsContext", description: "new", properties: [] }],
      });

      expect(diffApiDocuments(document([before]), document([after]))).toEqual([]);
    });
  });
});

describe("runCheck", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-check-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("snapshotExists is false when there is no snapshot file yet", async () => {
    const snapshotFile = path.join(tempDir, "COMPONENT_API.json");
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

    const result = await runCheck(components, snapshotFile);

    expect(result).toEqual({ snapshotExists: false, snapshotFile, changes: [], bump: "none" });
  });

  test("diffs parsed components against a snapshot on disk", async () => {
    const snapshotFile = path.join(tempDir, "COMPONENT_API.json");
    const before = mockComponentDocApi("Button", "Button.svelte", { props: [makeProp("href", { isRequired: true })] });
    writeFileSync(snapshotFile, JSON.stringify(document([before])));

    const after = mockComponentDocApi("Button", "Button.svelte", { props: [] });
    const components: ComponentDocs = new Map([["Button", after]]);

    const result = await runCheck(components, snapshotFile);

    expect(result.snapshotExists).toBe(true);
    expect(result.bump).toBe("major");
    expect(result.changes).toContainEqual(
      expect.objectContaining({ component: "Button", kind: "prop", name: "href", bump: "major" }),
    );
  });

  test("skips diffing when the snapshot schemaVersion does not match", async () => {
    const snapshotFile = path.join(tempDir, "COMPONENT_API.json");
    writeFileSync(snapshotFile, JSON.stringify({ ...document([]), schemaVersion: 99 }));

    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);
    const result = await runCheck(components, snapshotFile);

    expect(result.snapshotExists).toBe(true);
    expect(result.bump).toBe("none");
    expect(result.changes[0].message).toContain("schemaVersion");
  });
});

describe("formatCheckReport", () => {
  test("reports when no snapshot exists", () => {
    const report = formatCheckReport({
      snapshotExists: false,
      snapshotFile: "COMPONENT_API.json",
      changes: [],
      bump: "none",
    });
    expect(report).toContain("no snapshot found");
  });

  test("reports a clean run", () => {
    const report = formatCheckReport({
      snapshotExists: true,
      snapshotFile: "COMPONENT_API.json",
      changes: [],
      bump: "none",
    });
    expect(report).toContain("no API changes detected");
  });

  test("groups changes by component and prints the suggested bump", () => {
    const report = formatCheckReport({
      snapshotExists: true,
      snapshotFile: "COMPONENT_API.json",
      bump: "major",
      changes: [
        { component: "Button", kind: "prop", name: "href", bump: "major", message: 'prop "href" removed' },
        { component: "Card", kind: "component", bump: "minor", message: 'component "Card" added' },
      ],
    });

    expect(report).toContain("2 API changes detected");
    expect(report).toContain("Suggested semver bump: major.");
    expect(report).toContain("Button");
    expect(report).toContain('[BREAKING] prop "href" removed');
    expect(report).toContain("Card");
    expect(report).toContain('[additive] component "Card" added');
  });
});

describe("formatCheckReportJson", () => {
  test("serializes the CheckResult with a kind discriminator", () => {
    const result = {
      snapshotExists: true,
      snapshotFile: "COMPONENT_API.json",
      bump: "major" as const,
      changes: [
        {
          component: "Button",
          kind: "prop" as const,
          name: "href",
          bump: "major" as const,
          message: 'prop "href" removed',
        },
      ],
    };

    const json = formatCheckReportJson(result);

    expect(json.endsWith("\n")).toBe(true);
    expect(JSON.parse(json)).toEqual({ kind: "check-report", ...result });
  });

  test("serializes a missing snapshot the same as any other result", () => {
    const result = { snapshotExists: false, snapshotFile: "COMPONENT_API.json", changes: [], bump: "none" as const };

    expect(JSON.parse(formatCheckReportJson(result))).toEqual({ kind: "check-report", ...result });
  });
});
