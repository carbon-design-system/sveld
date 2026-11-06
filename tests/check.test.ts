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

    describe("DOM element subtypes", () => {
      const refChange = (before: string, after: string) =>
        diffApiDocuments(
          document([mockComponentDocApi("Table", "Table.svelte", { props: [makeProp("ref", { type: before })] })]),
          document([mockComponentDocApi("Table", "Table.svelte", { props: [makeProp("ref", { type: after })] })]),
        );

      test("dropping or adding a subtype next to its supertype is not reported", () => {
        expect(refChange("null | HTMLElement | HTMLTableElement", "null | HTMLElement")).toEqual([]);
        expect(refChange("null | HTMLElement", "null | HTMLElement | HTMLTableElement")).toEqual([]);
        expect(refChange("null | SVGElement | SVGSVGElement", "null | SVGElement")).toEqual([]);
        expect(refChange("null | Element | HTMLElement", "null | Element")).toEqual([]);
      });

      test("a subtype widened to its supertype is additive", () => {
        expect(refChange("null | HTMLDivElement", "null | HTMLElement")).toMatchObject([{ bump: "minor" }]);
        expect(refChange("null | HTMLElementTagNameMap[Tag]", "null | HTMLElement")).toMatchObject([{ bump: "minor" }]);
      });

      test("a supertype narrowed to a subtype is breaking", () => {
        expect(refChange("null | HTMLElement", "null | HTMLDivElement")).toMatchObject([{ bump: "major" }]);
        expect(refChange("null | HTMLElement", "null | HTMLElementTagNameMap[Tag]")).toMatchObject([{ bump: "major" }]);
      });

      test("an element swapped for an unrelated one is breaking", () => {
        expect(refChange("null | HTMLButtonElement", "null | HTMLAnchorElement")).toMatchObject([{ bump: "major" }]);
        expect(refChange("null | SVGSVGElement", "null | HTMLElement")).toMatchObject([{ bump: "major" }]);
      });
    });

    test("an unrelated type change is breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", { props: [makeProp("value", { type: "string" })] });
      const after = mockComponentDocApi("Button", "Button.svelte", { props: [makeProp("value", { type: "number" })] });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ bump: "major" });
    });

    test("an object-typed prop gaining a field is breaking, since callers pass it", () => {
      const before = mockComponentDocApi("Tabs", "Tabs.svelte", {
        props: [makeProp("tab", { type: "{ id: string }" })],
      });
      const after = mockComponentDocApi("Tabs", "Tabs.svelte", {
        props: [makeProp("tab", { type: "{ id: string; label: string }" })],
      });

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

    test("a function type gaining a trailing optional param is additive", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("onClick", { type: "(event: MouseEvent) => void" })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("onClick", { type: "(event: MouseEvent, index?: number) => void" })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ bump: "minor" });
    });

    test("a function type gaining a trailing required param is breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("onClick", { type: "(event: MouseEvent) => void" })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("onClick", { type: "(event: MouseEvent, index: number) => void" })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ bump: "major" });
    });

    test("a function type losing a param is breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("onClick", { type: "(event: MouseEvent, index?: number) => void" })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("onClick", { type: "(event: MouseEvent) => void" })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ bump: "major" });
    });

    test("a function type with a callback param gaining a trailing optional param is additive", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("onLoad", { type: "(done: () => void) => void" })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("onLoad", { type: "(done: () => void, index?: number) => void" })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ bump: "minor" });
    });

    test("widening a union with a parenthesized function member is additive", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("render", { type: "(() => string) | string" })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("render", { type: "(() => string) | string | number" })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ bump: "minor" });
    });

    test("a function type's changed return type is breaking", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("getValue", { type: "() => string" })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("getValue", { type: "() => number" })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ bump: "major" });
    });

    test("gaining a writable binding is additive; losing it is breaking", () => {
      const before = mockComponentDocApi("Input", "Input.svelte", {
        props: [makeProp("value", { type: "string" }), makeProp("checked", { type: "boolean", binding: "writable" })],
      });
      const after = mockComponentDocApi("Input", "Input.svelte", {
        props: [makeProp("value", { type: "string", binding: "writable" }), makeProp("checked", { type: "boolean" })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toContainEqual({
        component: "Input",
        kind: "prop",
        name: "value",
        bump: "minor",
        message: 'prop "value" gained a writable binding',
      });
      expect(changes).toContainEqual({
        component: "Input",
        kind: "prop",
        name: "checked",
        bump: "major",
        message: 'prop "checked" lost its writable binding',
      });
    });

    test("a runes $bindable() prop counts as a writable binding", () => {
      const before = mockComponentDocApi("Input", "Input.svelte", { props: [makeProp("value", { type: "string" })] });
      const after = mockComponentDocApi("Input", "Input.svelte", {
        props: [makeProp("value", { type: "string", bindable: true })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([
        {
          component: "Input",
          kind: "prop",
          name: "value",
          bump: "minor",
          message: 'prop "value" gained a writable binding',
        },
      ]);
    });

    test("a changed default is a patch when the type is unchanged", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("variant", { type: "string", value: '"primary"' })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("variant", { type: "string", value: '"secondary"' })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([
        {
          component: "Button",
          kind: "prop",
          name: "variant",
          bump: "patch",
          message: 'prop "variant" default changed from `"primary"` to `"secondary"`',
        },
      ]);
    });

    test("a changed default alongside a type change is not reported separately", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("variant", { type: "string", value: '"primary"' })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("variant", { type: "number", value: "1" })],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([
        {
          component: "Button",
          kind: "prop",
          name: "variant",
          bump: "major",
          message: 'prop "variant" type changed from `string` to `number`',
        },
      ]);
    });

    test("adding @deprecated is additive; removing it is a patch", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        props: [makeProp("label", { type: "string" }), makeProp("icon", { type: "string", deprecated: true })],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        props: [
          makeProp("label", { type: "string", deprecated: "use `text` instead" }),
          makeProp("icon", { type: "string" }),
        ],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toContainEqual({
        component: "Button",
        kind: "prop",
        name: "label",
        bump: "minor",
        message: 'prop "label" marked as deprecated',
      });
      expect(changes).toContainEqual({
        component: "Button",
        kind: "prop",
        name: "icon",
        bump: "patch",
        message: 'prop "icon" no longer deprecated',
      });
    });

    test("a reactive flip is additive, and a let prop turning const is breaking", () => {
      const before = mockComponentDocApi("Counter", "Counter.svelte", {
        props: [
          makeProp("count", { type: "number", constant: false, reactive: false }),
          makeProp("label", { type: "string", constant: false, reactive: false }),
        ],
      });
      const after = mockComponentDocApi("Counter", "Counter.svelte", {
        props: [
          makeProp("count", { type: "number", kind: "const", constant: true, reactive: false }),
          makeProp("label", { type: "string", constant: false, reactive: true }),
        ],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toContainEqual({
        component: "Counter",
        kind: "prop",
        name: "count",
        bump: "major",
        message: 'prop "count" became a read-only accessor',
      });
      expect(changes).toContainEqual({
        component: "Counter",
        kind: "prop",
        name: "label",
        bump: "minor",
        message: 'prop "label" became reactive',
      });
    });
  });

  test("a module export's constant flip is additive", () => {
    const exported = (kind: "let" | "const") =>
      makeProp("sizes", { type: "string[]", kind, constant: kind === "const" });
    const changes = diffApiDocuments(
      document([mockComponentDocApi("Select", "Select.svelte", { moduleExports: [exported("let")] })]),
      document([mockComponentDocApi("Select", "Select.svelte", { moduleExports: [exported("const")] })]),
    );
    expect(changes).toMatchObject([
      { kind: "moduleExport", bump: "minor", message: expect.stringContaining("became constant") },
    ]);
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

    test("a narrowed dispatched detail type is additive", () => {
      const before = mockComponentDocApi("Button", "Button.svelte", {
        events: [{ type: "dispatched", name: "change", detail: "string | number" }],
      });
      const after = mockComponentDocApi("Button", "Button.svelte", {
        events: [{ type: "dispatched", name: "change", detail: "string" }],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes[0]).toMatchObject({ kind: "event", name: "change", bump: "minor" });
    });

    function detailChange(oldDetail: string, newDetail: string) {
      const before = mockComponentDocApi("Tabs", "Tabs.svelte", {
        events: [{ type: "dispatched", name: "dismiss", detail: oldDetail }],
      });
      const after = mockComponentDocApi("Tabs", "Tabs.svelte", {
        events: [{ type: "dispatched", name: "dismiss", detail: newDetail }],
      });
      return diffApiDocuments(document([before]), document([after]));
    }

    test("a detail object gaining a field is additive", () => {
      expect(detailChange("{ id: string }", "{ id: string; modified: boolean }")).toEqual([
        {
          component: "Tabs",
          kind: "event",
          name: "dismiss",
          bump: "minor",
          message: 'event "dismiss" detail changed from `{ id: string }` to `{ id: string; modified: boolean }`',
        },
      ]);
    });

    test("a detail object losing a field, or a field becoming optional, is breaking", () => {
      expect(detailChange("{ id: string; modified: boolean }", "{ id: string }")[0]?.bump).toBe("major");
      expect(detailChange("{ id: string }", "{ id?: string }")[0]?.bump).toBe("major");
      expect(detailChange("{ id: string }", "{ id: number }")[0]?.bump).toBe("major");
    });

    test("detail object fields are compared like the detail itself", () => {
      expect(detailChange("{ id?: string }", "{ id: string }")[0]?.bump).toBe("minor");
      expect(detailChange("{ id: string }", "{ id: string | number }")[0]?.bump).toBe("major");
      expect(detailChange("{ id: string | number }", "{ id: string }")[0]?.bump).toBe("minor");
      expect(detailChange("{ tab: { id: string } }", "{ tab: { id: string; label: string } }")[0]?.bump).toBe("minor");
      expect(detailChange("{ tab: { id: string; label: string } }", "{ tab: { id: string } }")[0]?.bump).toBe("major");
    });

    test("a detail union that gains a member is breaking, since the listener reads it", () => {
      expect(detailChange('"a" | "b"', '"a" | "b" | "c"')[0]?.bump).toBe("major");
      expect(detailChange("{ id: string }", "{ id: string } | null")[0]?.bump).toBe("major");
      expect(detailChange("HTMLDivElement", "HTMLElement")[0]?.bump).toBe("major");
      expect(detailChange("HTMLElement", "HTMLDivElement")[0]?.bump).toBe("minor");
      expect(detailChange('"a" | "b"', '"b" | "a"')).toEqual([]);
    });

    function forwardedChange(oldEvent: Record<string, string>, newEvent: Record<string, string>) {
      const event = (fields: Record<string, string>) => ({
        type: "forwarded" as const,
        name: "close",
        element: "Inner",
        ...fields,
      });
      return diffApiDocuments(
        document([mockComponentDocApi("ComboButton", "ComboButton.svelte", { events: [event(oldEvent)] })]),
        document([mockComponentDocApi("ComboButton", "ComboButton.svelte", { events: [event(newEvent)] })]),
      );
    }

    test("a forwarded event's detail is compared like a dispatched one", () => {
      expect(forwardedChange({ detail: "{ id: string }" }, { detail: "number" })).toEqual([
        {
          component: "ComboButton",
          kind: "event",
          name: "close",
          bump: "major",
          message: 'event "close" type changed from `CustomEvent<{ id: string }>` to `CustomEvent<number>`',
        },
      ]);
      expect(forwardedChange({ detail: "{ id: string }" }, { detail: "{ id: string; open: boolean }" })).toMatchObject([
        { bump: "minor" },
      ]);
      expect(forwardedChange({ detail: '"a"' }, { detail: '"a" | "b"' })).toMatchObject([{ bump: "major" }]);
      expect(forwardedChange({ detail: "{ id: string }" }, {})).toMatchObject([
        {
          bump: "major",
          message: 'event "close" type changed from `CustomEvent<{ id: string }>` to `CustomEvent<any>`',
        },
      ]);
    });

    test("a forwarded event whose element changes is compared by the event type the listener gets", () => {
      expect(forwardedChange({ element: "button" }, { element: "a" })).toEqual([]);
      expect(forwardedChange({ name: "click", element: "button" }, { name: "click", element: "Inner" })).toEqual([]);
      const toComponent = diffApiDocuments(
        document([
          mockComponentDocApi("X", "X.svelte", { events: [{ type: "forwarded", name: "close", element: "dialog" }] }),
        ]),
        document([
          mockComponentDocApi("X", "X.svelte", { events: [{ type: "forwarded", name: "close", element: "Inner" }] }),
        ]),
      );
      expect(toComponent).toMatchObject([{ bump: "major" }]);
    });

    test("a detail that isn't a plain object literal falls back to breaking", () => {
      expect(detailChange("{ id: string }", "{ id: string; [key: string]: unknown }")[0]?.bump).toBe("major");
      expect(detailChange('{ "aria-id": string }', '{ "aria-id": string; open: boolean }')[0]?.bump).toBe("major");
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

    test("a slot_props object gaining a prop is additive", () => {
      const before = mockComponentDocApi("Card", "Card.svelte", {
        slots: [{ name: null, default: true, slot_props: "{ title: string }" }],
      });
      const after = mockComponentDocApi("Card", "Card.svelte", {
        slots: [{ name: null, default: true, slot_props: "{ title: string; subtitle: string }" }],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([expect.objectContaining({ kind: "slot", name: "default", bump: "minor" })]);
    });

    test("a slot_props field whose union gains a member is breaking", () => {
      const before = mockComponentDocApi("Card", "Card.svelte", {
        slots: [{ name: null, default: true, slot_props: "{ value: string }" }],
      });
      const after = mockComponentDocApi("Card", "Card.svelte", {
        slots: [{ name: null, default: true, slot_props: "{ value: string | number }" }],
      });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([expect.objectContaining({ kind: "slot", name: "default", bump: "major" })]);
    });
  });

  describe("type text", () => {
    const propChange = (oldType: string, newType: string) =>
      diffApiDocuments(
        document([mockComponentDocApi("X", "X.svelte", { props: [makeProp("p", { type: oldType })] })]),
        document([mockComponentDocApi("X", "X.svelte", { props: [makeProp("p", { type: newType })] })]),
      );
    const slotChange = (oldProps: string, newProps: string) =>
      diffApiDocuments(
        document([
          mockComponentDocApi("X", "X.svelte", { slots: [{ name: "default", default: true, slot_props: oldProps }] }),
        ]),
        document([
          mockComponentDocApi("X", "X.svelte", { slots: [{ name: "default", default: true, slot_props: newProps }] }),
        ]),
      );

    test("layout, comments and member separators don't count", () => {
      expect(propChange("{ a: string }", "{a: string}")).toEqual([]);
      expect(propChange("{ a: string; b: number }", "{\n  /** The a. */\n  a: string;\n  b: number;\n}")).toEqual([]);
      expect(propChange("{ a: string, b: number }", "{ a: string; b: number }")).toEqual([]);
      expect(slotChange("{ a: string }", "{\n  // The a.\n  a: string\n}")).toEqual([]);
      expect(propChange('"a  b" | "c"', '"a b" | "c"')).toMatchObject([{ bump: "major" }]);
    });

    test("a callback prop that becomes optional is additive, and the reverse is breaking", () => {
      expect(propChange("() => void", "(() => void) | undefined")).toMatchObject([{ bump: "minor" }]);
      expect(propChange("(id: string) => string", "((id: string) => string) | null")).toMatchObject([
        { bump: "minor" },
      ]);
      expect(propChange("(() => void) | undefined", "() => void")).toMatchObject([{ bump: "major" }]);
      expect(propChange("(() => void) | undefined", "((id: string) => void) | undefined")).toMatchObject([
        { bump: "major" },
      ]);
    });

    test("a callback that becomes optional where the consumer reads it is breaking", () => {
      expect(slotChange("{ close: () => void }", "{ close: (() => void) | undefined }")).toMatchObject([
        { bump: "major" },
      ]);
    });

    test("an object prop is compared member by member", () => {
      expect(propChange("{ a: string }", "{ a: string; b?: number }")).toMatchObject([{ bump: "minor" }]);
      expect(propChange("{ a: string }", "{ a?: string }")).toMatchObject([{ bump: "minor" }]);
      expect(propChange("{ a: string }", "{ a: string | number }")).toMatchObject([{ bump: "minor" }]);
      expect(propChange("{ a: string } | undefined", "{ a: string; b?: number } | undefined")).toMatchObject([
        { bump: "minor" },
      ]);
      expect(propChange("{ a: string }", "{ a: string; b: number }")).toMatchObject([{ bump: "major" }]);
      expect(propChange("{ a: string; b: number }", "{ a: string }")).toMatchObject([{ bump: "major" }]);
      expect(propChange("{ a?: string }", "{ a: string }")).toMatchObject([{ bump: "major" }]);
      expect(propChange("{ a: string | number }", "{ a: string }")).toMatchObject([{ bump: "major" }]);
    });

    test("an object member of a wider union is compared member by member", () => {
      expect(
        propChange("undefined | boolean | { a?: number }", "undefined | boolean | { a?: number, b?: boolean }"),
      ).toMatchObject([{ bump: "minor" }]);
      expect(propChange("boolean | { a?: number }", "boolean | { a: number }")).toMatchObject([{ bump: "major" }]);
      expect(propChange("boolean | { a?: number }", "string | { a?: number; b?: number }")).toMatchObject([
        { bump: "major" },
      ]);
      expect(slotChange("{ v: boolean | { a: number } }", "{ v: boolean | { a: number; b: number } }")).toMatchObject([
        { bump: "minor" },
      ]);
    });

    test("a function type keeps its union return type", () => {
      expect(propChange("() => string", "() => string | number")).toMatchObject([{ bump: "major" }]);
    });

    test("an object prop that gains a nullish member is additive", () => {
      expect(propChange("{ a: string }", "{ a: string } | null")).toMatchObject([{ bump: "minor" }]);
      expect(propChange("{ a: string } | null", "{ a: string }")).toMatchObject([{ bump: "major" }]);
    });
  });

  describe("read-only props and exports", () => {
    function typeChange(prop: ComponentDocApi["props"][number], oldType: string, newType: string, field = "props") {
      const before = mockComponentDocApi("Select", "Select.svelte", { [field]: [{ ...prop, type: oldType }] });
      const after = mockComponentDocApi("Select", "Select.svelte", { [field]: [{ ...prop, type: newType }] });
      return diffApiDocuments(document([before]), document([after]))[0]?.bump;
    }

    test("a module export or prop accessor that gains a union member is breaking", () => {
      expect(
        typeChange(makeProp("sizes", { kind: "const" }), '"sm" | "md"', '"sm" | "md" | "lg"', "moduleExports"),
      ).toBe("major");
      expect(typeChange(makeProp("size", { kind: "const", constant: true }), '"sm"', '"sm" | "lg"')).toBe("major");
      expect(
        typeChange(makeProp("focus", { kind: "function", isFunctionDeclaration: true }), '"sm"', '"sm" | "lg"'),
      ).toBe("major");
      expect(typeChange(makeProp("size", { kind: "const", constant: true }), '"sm" | "lg"', '"sm"')).toBe("minor");
    });

    test("a prop that moves to or from an accessor is breaking", () => {
      const change = (oldProp: ComponentDocApi["props"][number], newProp: ComponentDocApi["props"][number]) =>
        diffApiDocuments(
          document([mockComponentDocApi("Select", "Select.svelte", { props: [oldProp] })]),
          document([mockComponentDocApi("Select", "Select.svelte", { props: [newProp] })]),
        );
      const letProp = makeProp("size", { type: "string" });
      const constProp = makeProp("size", { type: "string", kind: "const", constant: true });
      const fnProp = makeProp("size", { type: "() => void", kind: "function", isFunctionDeclaration: true });

      expect(change(letProp, constProp)).toEqual([
        {
          component: "Select",
          kind: "prop",
          name: "size",
          bump: "major",
          message: 'prop "size" became a read-only accessor',
        },
      ]);
      expect(change(constProp, letProp)).toMatchObject([
        { bump: "major", message: 'prop "size" stopped being a read-only accessor' },
      ]);
      expect(change(letProp, fnProp)).toMatchObject([{ bump: "major" }]);
      expect(change(constProp, fnProp)).toMatchObject([
        { bump: "major", message: expect.stringContaining("type changed") },
      ]);
    });

    test("a let prop, bindable or not, still widens as additive", () => {
      expect(typeChange(makeProp("size"), '"sm"', '"sm" | "lg"')).toBe("minor");
      expect(typeChange(makeProp("value", { bindable: true }), "string", "string | number")).toBe("minor");
    });
  });

  describe("shape fields", () => {
    test("rest props on a component that had none are additive", () => {
      const before = mockComponentDocApi("Toast", "Toast.svelte");
      const after = mockComponentDocApi("Toast", "Toast.svelte", { rest_props: { type: "Element", name: "div" } });

      const changes = diffApiDocuments(document([before]), document([after]));
      expect(changes).toEqual([
        { component: "Toast", kind: "shape", name: "rest_props", bump: "minor", message: '"rest_props" added' },
      ]);
    });

    test("removed or changed rest props are breaking", () => {
      const div = mockComponentDocApi("Toast", "Toast.svelte", { rest_props: { type: "Element", name: "div" } });
      const span = mockComponentDocApi("Toast", "Toast.svelte", { rest_props: { type: "Element", name: "span" } });
      const none = mockComponentDocApi("Toast", "Toast.svelte");

      for (const after of [span, none]) {
        const changes = diffApiDocuments(document([div]), document([after]));
        expect(changes).toEqual([expect.objectContaining({ name: "rest_props", bump: "major" })]);
      }
    });

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
  });

  describe("contexts", () => {
    type ContextDoc = NonNullable<ComponentDocApi["contexts"]>[number];
    type ContextProp = ContextDoc["properties"][number];

    function contextProp(name: string, type: string, overrides?: Partial<ContextProp>): ContextProp {
      return { name, type, optional: false, ...overrides };
    }

    function contextDoc(properties: ContextProp[], overrides?: Partial<ContextDoc>): ContextDoc {
      return { key: "carbon:Modal", typeName: "CarbonModalContext", properties, ...overrides };
    }

    function diffContexts(before: ContextDoc[], after: ContextDoc[]) {
      return diffApiDocuments(
        document([mockComponentDocApi("Modal", "Modal.svelte", { contexts: before })]),
        document([mockComponentDocApi("Modal", "Modal.svelte", { contexts: after })]),
      );
    }

    test("a removed property names the context and the property", () => {
      const changes = diffContexts(
        [contextDoc([contextProp("isInitialFocus", "(node: any) => any")])],
        [contextDoc([])],
      );

      expect(changes).toEqual([
        {
          component: "Modal",
          kind: "context",
          name: "carbon:Modal",
          property: "isInitialFocus",
          bump: "major",
          message: 'context "carbon:Modal" property "isInitialFocus" removed',
        },
      ]);
    });

    test("an added property is additive", () => {
      const changes = diffContexts([contextDoc([])], [contextDoc([contextProp("open", "boolean")])]);

      expect(changes).toEqual([
        {
          component: "Modal",
          kind: "context",
          name: "carbon:Modal",
          property: "open",
          bump: "minor",
          message: 'context "carbon:Modal" property "open" added',
        },
      ]);
    });

    test("a changed property type shows both types and is classified like an event detail", () => {
      const narrowed = diffContexts(
        [contextDoc([contextProp("size", '"sm" | "lg"')])],
        [contextDoc([contextProp("size", '"sm"')])],
      );
      expect(narrowed).toMatchObject([
        {
          property: "size",
          bump: "minor",
          message: 'context "carbon:Modal" property "size" type changed from `"sm" | "lg"` to `"sm"`',
        },
      ]);

      const widened = diffContexts(
        [contextDoc([contextProp("size", '"sm"')])],
        [contextDoc([contextProp("size", '"sm" | "lg"')])],
      );
      expect(widened).toMatchObject([{ property: "size", bump: "major" }]);
    });

    test("a property turning optional is breaking and turning required is additive", () => {
      const required = contextDoc([contextProp("close", "() => void")]);
      const optional = contextDoc([contextProp("close", "() => void", { optional: true })]);

      expect(diffContexts([required], [optional])).toMatchObject([
        { property: "close", bump: "major", message: 'context "carbon:Modal" property "close" became optional' },
      ]);
      expect(diffContexts([optional], [required])).toMatchObject([
        { property: "close", bump: "minor", message: 'context "carbon:Modal" property "close" became required' },
      ]);
    });

    test("reports each property and leaves untouched ones out", () => {
      const changes = diffContexts(
        [contextDoc([contextProp("a", "string"), contextProp("b", "number"), contextProp("c", "boolean")])],
        [contextDoc([contextProp("c", "boolean"), contextProp("a", "number"), contextProp("d", "string")])],
      );

      expect(changes.map(({ property, bump }) => [property, bump])).toEqual([
        ["d", "minor"],
        ["b", "major"],
        ["a", "major"],
      ]);
    });

    test("an added context is additive and a removed one is breaking", () => {
      const modal = contextDoc([]);
      const layer = contextDoc([], { key: "carbon:Layer", typeName: "CarbonLayerContext" });

      expect(diffContexts([modal], [modal, layer])).toEqual([
        {
          component: "Modal",
          kind: "context",
          name: "carbon:Layer",
          bump: "minor",
          message: 'context "carbon:Layer" added',
        },
      ]);
      expect(diffContexts([modal, layer], [modal])).toEqual([
        {
          component: "Modal",
          kind: "context",
          name: "carbon:Layer",
          bump: "major",
          message: 'context "carbon:Layer" removed',
        },
      ]);
    });

    test("a context typed as a whole is classified on that type", () => {
      const store = (type: string) => contextDoc([], { key: "carbon:Layer", typeName: "CarbonLayerContext", type });

      expect(diffContexts([store("Readable<number>")], [store("Readable<number>")])).toEqual([]);
      expect(diffContexts([store("Readable<number>")], [store("Writable<number>")])).toMatchObject([
        {
          name: "carbon:Layer",
          bump: "major",
          message: 'context "carbon:Layer" type changed from `Readable<number>` to `Writable<number>`',
        },
      ]);
      expect(
        diffContexts(
          [store("Readable<number>")],
          [contextDoc([], { key: "carbon:Layer", typeName: "CarbonLayerContext" })],
        ),
      ).toMatchObject([
        {
          bump: "major",
          message: 'context "carbon:Layer" type changed from `Readable<number>` to an object of properties',
        },
      ]);
    });

    test("a renamed context type or a new unresolved spread is breaking", () => {
      expect(diffContexts([contextDoc([])], [contextDoc([], { typeName: "ModalContext" })])).toMatchObject([
        {
          bump: "major",
          message: 'context "carbon:Modal" type name changed from `CarbonModalContext` to `ModalContext`',
        },
      ]);
      expect(diffContexts([contextDoc([])], [contextDoc([], { hasUnresolvedSpread: true })])).toMatchObject([
        { bump: "major", message: 'context "carbon:Modal" gained an unresolved spread' },
      ]);
    });

    test("descriptions and source ranges are not reported", () => {
      const before = contextDoc([contextProp("open", "boolean", { description: "old" })], {
        description: "old",
        source: { start: { line: 1, column: 0 }, end: { line: 1, column: 5 } },
      });
      const after = contextDoc([contextProp("open", "boolean", { description: "new" })], {
        description: "new",
        source: { start: { line: 9, column: 0 }, end: { line: 9, column: 5 } },
      });

      expect(diffContexts([before], [after])).toEqual([]);
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
    expect(result.changes).toEqual([
      {
        component: "*",
        kind: "schema",
        bump: "none",
        message: "snapshot schemaVersion 99 differs from 1; regenerate the snapshot",
      },
    ]);
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
    expect(JSON.parse(json)).toEqual({ kind: "check-report", schemaVersion: 1, ...result });
  });

  test("stamps the envelope with schemaVersion 1", () => {
    const result = { snapshotExists: false, snapshotFile: "COMPONENT_API.json", changes: [], bump: "none" as const };

    expect(JSON.parse(formatCheckReportJson(result)).schemaVersion).toBe(1);
  });

  test("serializes a missing snapshot the same as any other result", () => {
    const result = { snapshotExists: false, snapshotFile: "COMPONENT_API.json", changes: [], bump: "none" as const };

    expect(JSON.parse(formatCheckReportJson(result))).toEqual({ kind: "check-report", schemaVersion: 1, ...result });
  });
});
