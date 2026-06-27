import {
  type ComponentApi,
  type ComponentApiComponent,
  type ComponentApiProp,
  diffComponentApi,
  formatApiDiff,
  SNAPSHOT_VERSION,
} from "../src/diff";

function prop(overrides: Partial<ComponentApiProp> = {}): ComponentApiProp {
  return {
    kind: "let",
    constant: false,
    isRequired: false,
    isFunction: false,
    reactive: false,
    ...overrides,
  };
}

function component(overrides: Partial<ComponentApiComponent> = {}): ComponentApiComponent {
  return {
    props: {},
    moduleExports: {},
    slots: {},
    events: {},
    typedefs: {},
    rest_props: false,
    generics: null,
    ...overrides,
  };
}

function api(components: Record<string, ComponentApiComponent>): ComponentApi {
  return { version: SNAPSHOT_VERSION, components };
}

describe("diffComponentApi", () => {
  test("reports no changes for identical snapshots", () => {
    const snapshot = api({ Button: component({ props: { type: prop({ type: "string" }) } }) });
    const diff = diffComponentApi(snapshot, snapshot);

    expect(diff.matches).toBe(true);
    expect(diff.classification).toBeNull();
    expect(diff.changes).toEqual([]);
  });

  test("classifies a removed prop as breaking", () => {
    const before = api({ Button: component({ props: { type: prop(), size: prop() } }) });
    const after = api({ Button: component({ props: { type: prop() } }) });

    const diff = diffComponentApi(before, after);

    expect(diff.matches).toBe(false);
    expect(diff.classification).toBe("breaking");
    expect(diff.breaking).toHaveLength(1);
    expect(diff.breaking[0]).toMatchObject({ category: "prop", component: "Button", member: "size" });
    expect(diff.breaking[0].message).toContain("removed");
  });

  test("classifies a removed component as breaking", () => {
    const before = api({ Button: component(), Modal: component() });
    const after = api({ Button: component() });

    const diff = diffComponentApi(before, after);

    expect(diff.classification).toBe("breaking");
    expect(diff.breaking[0]).toMatchObject({ category: "component", component: "Modal" });
  });

  test("classifies a new optional prop as additive", () => {
    const before = api({ Button: component({ props: { type: prop() } }) });
    const after = api({ Button: component({ props: { type: prop(), disabled: prop({ type: "boolean" }) } }) });

    const diff = diffComponentApi(before, after);

    expect(diff.classification).toBe("additive");
    expect(diff.additive[0]).toMatchObject({ category: "prop", member: "disabled" });
  });

  test("classifies a new required prop as breaking", () => {
    const before = api({ Button: component() });
    const after = api({ Button: component({ props: { value: prop({ isRequired: true }) } }) });

    const diff = diffComponentApi(before, after);

    expect(diff.classification).toBe("breaking");
    expect(diff.breaking[0].message).toContain("required");
  });

  test("classifies a prop type change as breaking", () => {
    const before = api({ Button: component({ props: { size: prop({ type: '"sm" | "lg"' }) } }) });
    const after = api({ Button: component({ props: { size: prop({ type: '"small" | "large"' }) } }) });

    const diff = diffComponentApi(before, after);

    expect(diff.classification).toBe("breaking");
    expect(diff.breaking[0].message).toContain("type changed");
  });

  test("classifies optional -> required as breaking but required -> optional as additive", () => {
    const optionalToRequired = diffComponentApi(
      api({ Button: component({ props: { x: prop({ isRequired: false }) } }) }),
      api({ Button: component({ props: { x: prop({ isRequired: true }) } }) }),
    );
    expect(optionalToRequired.classification).toBe("breaking");

    const requiredToOptional = diffComponentApi(
      api({ Button: component({ props: { x: prop({ isRequired: true }) } }) }),
      api({ Button: component({ props: { x: prop({ isRequired: false }) } }) }),
    );
    expect(requiredToOptional.classification).toBe("additive");
  });

  test("classifies a description-only change as doc-only", () => {
    const before = api({ Button: component({ props: { type: prop({ description: "old" }) } }) });
    const after = api({ Button: component({ props: { type: prop({ description: "new" }) } }) });

    const diff = diffComponentApi(before, after);

    expect(diff.classification).toBe("doc-only");
    expect(diff.docOnly[0]).toMatchObject({ category: "prop", member: "type" });
  });

  test("classifies a component-comment change as doc-only", () => {
    const before = api({ Button: component({ description: "A button." }) });
    const after = api({ Button: component({ description: "A nice button." }) });

    expect(diffComponentApi(before, after).classification).toBe("doc-only");
  });

  test("classifies slot and event additions and removals", () => {
    const before = api({
      Button: component({
        slots: { default: { default: true } },
        events: { click: { type: "forwarded" } },
      }),
    });
    const after = api({
      Button: component({
        slots: { default: { default: true }, icon: { default: false } },
        events: {},
      }),
    });

    const diff = diffComponentApi(before, after);

    expect(diff.additive.some((c) => c.category === "slot" && c.member === "icon")).toBe(true);
    expect(diff.breaking.some((c) => c.category === "event" && c.member === "click")).toBe(true);
    expect(diff.classification).toBe("breaking");
  });

  test("reports the most severe change as the overall classification", () => {
    const before = api({ Button: component({ props: { a: prop({ type: "string", description: "x" }) } }) });
    const after = api({
      Button: component({ props: { a: prop({ type: "number", description: "y" }), b: prop() } }),
    });

    const diff = diffComponentApi(before, after);

    expect(diff.breaking.length).toBeGreaterThan(0);
    expect(diff.additive.length).toBeGreaterThan(0);
    expect(diff.docOnly.length).toBeGreaterThan(0);
    expect(diff.classification).toBe("breaking");
  });
});

describe("formatApiDiff", () => {
  test("renders a friendly message when snapshots match", () => {
    const snapshot = api({ Button: component() });
    expect(formatApiDiff(diffComponentApi(snapshot, snapshot))).toContain("matches the golden snapshot");
  });

  test("groups changes by severity with counts and markers", () => {
    const before = api({ Button: component({ props: { size: prop({ type: "string" }) } }) });
    const after = api({
      Button: component({ props: { size: prop({ type: "number" }), disabled: prop() }, description: "new" }),
    });

    const report = formatApiDiff(diffComponentApi(before, after));

    expect(report).toContain("Component API drift detected");
    expect(report).toContain("1 breaking");
    expect(report).toContain("BREAKING");
    expect(report).toContain("ADDITIVE");
    expect(report).toContain("✖");
    expect(report).toContain("+");
  });
});
