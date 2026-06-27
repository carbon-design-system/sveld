import { type ComponentApiFile, diffComponentApi, formatDiffReport } from "../src/diff";

interface PropInput {
  name: string;
  type?: string;
  isRequired?: boolean;
  description?: string;
}

function api(props: PropInput[], extra: Record<string, unknown> = {}): ComponentApiFile {
  return {
    schemaVersion: 1,
    components: [
      {
        moduleName: "Button",
        props,
        events: [],
        slots: [],
        ...extra,
      },
    ],
  };
}

function kinds(result: ReturnType<typeof diffComponentApi>): string[] {
  return result.changes.map((c) => c.kind);
}

describe("diffComponentApi", () => {
  describe("props", () => {
    test("classifies a removed prop as breaking", () => {
      const result = diffComponentApi(api([{ name: "size", type: "string" }]), api([]));
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "prop-removed", target: "size" });
      expect(result.hasBreaking).toBe(true);
    });

    test("classifies a new optional prop as additive", () => {
      const result = diffComponentApi(api([]), api([{ name: "size", type: "string", isRequired: false }]));
      expect(result.changes[0]).toMatchObject({ severity: "additive", kind: "prop-added", target: "size" });
      expect(result.hasBreaking).toBe(false);
    });

    test("classifies a new required prop as breaking", () => {
      const result = diffComponentApi(api([]), api([{ name: "size", type: "string", isRequired: true }]));
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "prop-required-added", target: "size" });
    });

    test("classifies a prop becoming required as breaking", () => {
      const result = diffComponentApi(
        api([{ name: "size", type: "string", isRequired: false }]),
        api([{ name: "size", type: "string", isRequired: true }]),
      );
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "prop-required-added" });
    });

    test("classifies a prop becoming optional as additive", () => {
      const result = diffComponentApi(
        api([{ name: "size", type: "string", isRequired: true }]),
        api([{ name: "size", type: "string", isRequired: false }]),
      );
      expect(result.changes[0]).toMatchObject({ severity: "additive", kind: "prop-optional" });
    });

    test("classifies a narrowed union type as breaking", () => {
      const result = diffComponentApi(
        api([{ name: "size", type: '"sm" | "md" | "lg"' }]),
        api([{ name: "size", type: '"sm" | "md"' }]),
      );
      expect(result.changes[0]).toMatchObject({
        severity: "breaking",
        kind: "prop-type-narrowed",
        from: '"sm" | "md" | "lg"',
        to: '"sm" | "md"',
      });
    });

    test("classifies a widened union type as additive", () => {
      const result = diffComponentApi(
        api([{ name: "size", type: '"sm" | "md"' }]),
        api([{ name: "size", type: '"sm" | "md" | "lg"' }]),
      );
      expect(result.changes[0]).toMatchObject({ severity: "additive", kind: "prop-type-widened" });
    });

    test("treats moving from `any` to a concrete type as narrowing", () => {
      const result = diffComponentApi(api([{ name: "x", type: "any" }]), api([{ name: "x", type: "string" }]));
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "prop-type-narrowed" });
    });

    test("classifies an unrelated type change as breaking", () => {
      const result = diffComponentApi(api([{ name: "x", type: "string" }]), api([{ name: "x", type: "number" }]));
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "prop-type-changed" });
    });

    test("classifies a description-only change as doc-only", () => {
      const result = diffComponentApi(
        api([{ name: "size", type: "string", description: "old" }]),
        api([{ name: "size", type: "string", description: "new" }]),
      );
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toMatchObject({ severity: "doc-only", kind: "prop-doc-changed" });
      expect(result.hasBreaking).toBe(false);
    });

    test("ignores props with no changes", () => {
      const result = diffComponentApi(
        api([{ name: "size", type: "string", description: "same" }]),
        api([{ name: "size", type: "string", description: "same" }]),
      );
      expect(result.changes).toHaveLength(0);
    });
  });

  describe("rename heuristic", () => {
    test("detects a rename when a removed and added prop share a type", () => {
      const result = diffComponentApi(
        api([{ name: "size", type: '"sm" | "lg"' }]),
        api([{ name: "scale", type: '"sm" | "lg"' }]),
      );
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toMatchObject({
        severity: "breaking",
        kind: "prop-renamed",
        from: "size",
        to: "scale",
      });
    });

    test("does not treat differing types as a rename", () => {
      const result = diffComponentApi(
        api([{ name: "size", type: "string" }]),
        api([{ name: "scale", type: "number" }]),
      );
      expect(kinds(result).sort()).toEqual(["prop-added", "prop-removed"]);
    });

    test("can be disabled, reporting a plain remove + add", () => {
      const result = diffComponentApi(
        api([{ name: "size", type: '"sm" | "lg"' }]),
        api([{ name: "scale", type: '"sm" | "lg"' }]),
        { detectRenames: false },
      );
      expect(kinds(result).sort()).toEqual(["prop-added", "prop-removed"]);
    });
  });

  describe("events", () => {
    const withEvents = (events: unknown[]): ComponentApiFile =>
      ({
        schemaVersion: 1,
        components: [{ moduleName: "Button", props: [], slots: [], events }],
      }) as ComponentApiFile;

    test("classifies a removed event as breaking", () => {
      const result = diffComponentApi(withEvents([{ type: "dispatched", name: "select" }]), withEvents([]));
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "event-removed", target: "select" });
    });

    test("classifies a new event as additive", () => {
      const result = diffComponentApi(withEvents([]), withEvents([{ type: "dispatched", name: "select" }]));
      expect(result.changes[0]).toMatchObject({ severity: "additive", kind: "event-added", target: "select" });
    });

    test("classifies a changed event detail as breaking", () => {
      const result = diffComponentApi(
        withEvents([{ type: "dispatched", name: "select", detail: "{ id: string }" }]),
        withEvents([{ type: "dispatched", name: "select", detail: "{ id: number }" }]),
      );
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "event-detail-changed" });
    });

    test("classifies an event description change as doc-only", () => {
      const result = diffComponentApi(
        withEvents([{ type: "dispatched", name: "select", description: "old" }]),
        withEvents([{ type: "dispatched", name: "select", description: "new" }]),
      );
      expect(result.changes[0]).toMatchObject({ severity: "doc-only", kind: "event-doc-changed" });
    });
  });

  describe("slots", () => {
    const withSlots = (slots: unknown[]): ComponentApiFile =>
      ({
        schemaVersion: 1,
        components: [{ moduleName: "Button", props: [], events: [], slots }],
      }) as ComponentApiFile;

    test("classifies a removed named slot as breaking", () => {
      const result = diffComponentApi(withSlots([{ name: "header", default: false }]), withSlots([]));
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "slot-removed", target: "header" });
    });

    test("classifies a new slot as additive", () => {
      const result = diffComponentApi(withSlots([]), withSlots([{ name: "header", default: false }]));
      expect(result.changes[0]).toMatchObject({ severity: "additive", kind: "slot-added", target: "header" });
    });

    test("treats the default slot by a stable label", () => {
      const result = diffComponentApi(withSlots([{ name: null, default: true }]), withSlots([]));
      expect(result.changes[0]).toMatchObject({ kind: "slot-removed", target: "default" });
    });

    test("classifies a slot_props change as breaking", () => {
      const result = diffComponentApi(
        withSlots([{ name: null, default: true, slot_props: "{ value: string }" }]),
        withSlots([{ name: null, default: true, slot_props: "{ value: number }" }]),
      );
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "slot-props-changed" });
    });
  });

  describe("components", () => {
    test("classifies a removed component as breaking", () => {
      const result = diffComponentApi(api([]), { schemaVersion: 1, components: [] });
      expect(result.changes[0]).toMatchObject({ severity: "breaking", kind: "component-removed", component: "Button" });
    });

    test("classifies an added component as additive", () => {
      const result = diffComponentApi({ schemaVersion: 1, components: [] }, api([]));
      expect(result.changes[0]).toMatchObject({ severity: "additive", kind: "component-added", component: "Button" });
    });
  });

  describe("summary, ordering, and report", () => {
    test("counts and orders changes by severity", () => {
      const result = diffComponentApi(
        api([
          { name: "removed", type: "string" },
          { name: "doc", type: "string", description: "old" },
        ]),
        api([
          { name: "added", type: "number", isRequired: false },
          { name: "doc", type: "string", description: "new" },
        ]),
      );
      expect(result.summary).toEqual({ breaking: 1, additive: 1, docOnly: 1, total: 3 });
      expect(result.changes.map((c) => c.severity)).toEqual(["breaking", "additive", "doc-only"]);
    });

    test("renders a grouped human-readable report", () => {
      const result = diffComponentApi(api([{ name: "size", type: "string" }]), api([]));
      const report = formatDiffReport(result);
      expect(report).toContain("BREAKING (1)");
      expect(report).toContain('[Button] Prop "size" was removed');
      expect(report).toContain("Summary: 1 breaking, 0 additive, 0 doc-only.");
    });

    test("reports no changes for identical snapshots", () => {
      const same = api([{ name: "size", type: "string" }]);
      const result = diffComponentApi(same, same);
      expect(result.changes).toHaveLength(0);
      expect(formatDiffReport(result)).toBe("No API changes detected.");
    });
  });
});
