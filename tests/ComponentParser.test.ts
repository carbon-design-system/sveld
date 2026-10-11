import ComponentParser from "../src/ComponentParser";
import { getParsedComponentTypeScriptMetadata } from "../src/parsed-component-metadata";

describe("ComponentParser", () => {
  const diagnostics = {
    moduleName: "TestComponent",
    filePath: "/test/TestComponent.svelte",
  };

  test("detects legacy syntax with plain JavaScript script", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        export let label;
      </script>

      <button>{label}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.syntaxMode).toBe("legacy");
    expect(result.scriptLanguage).toBe("js");
  });

  test("orders events the same way whatever the machine locale", () => {
    const original = String.prototype.localeCompare;
    const czech = new Intl.Collator("cs");
    // Czech collation sorts "ch" after "h", so a locale-following sort would put hover first.
    String.prototype.localeCompare = function (this: string, that: string) {
      return czech.compare(this, that);
    };
    try {
      const source = `
        <script>
          import { createEventDispatcher } from "svelte";
          const dispatch = createEventDispatcher();
          function f() { dispatch("hover"); dispatch("change"); dispatch("click"); }
        </script>
      `;
      const result = new ComponentParser().parseSvelteComponent(source, diagnostics);
      expect(result.events.map((event) => event.name)).toEqual(["change", "click", "hover"]);
    } finally {
      String.prototype.localeCompare = original;
    }
  });

  test("orders type imports the same way whatever the machine locale", () => {
    const original = String.prototype.localeCompare;
    const czech = new Intl.Collator("cs");
    String.prototype.localeCompare = function (this: string, that: string) {
      return czech.compare(this, that);
    };
    try {
      const source = `
        <script lang="ts">
          import type { H } from "./hover";
          import type { C } from "./change";
          export let h: H;
          export let c: C;
        </script>
      `;
      const result = new ComponentParser().parseSvelteComponent(source, diagnostics);
      expect(getParsedComponentTypeScriptMetadata(result)?.typeImportStatements).toEqual([
        'import type { C } from "./change";',
        'import type { H } from "./hover";',
      ]);
    } finally {
      String.prototype.localeCompare = original;
    }
  });

  describe("hoisted call defaults", () => {
    test("resolves a default from a top-level function declared after the prop", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          export let id = uniqueId();

          /** @returns {string} */
          function uniqueId() { return "ccs"; }
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.props[0]).toMatchObject({ name: "id", type: "string", value: "uniqueId()" });
    });

    test("resolves a default from an exported function declared after the prop", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          export let id = uniqueId();

          /** @returns {string} */
          export function uniqueId() { return "ccs"; }
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.props[0]).toMatchObject({ name: "id", type: "string", value: "uniqueId()" });
    });

    test("does not hoist a function declared inside a nested block", () => {
      // Block-level functions are block-scoped in module (strict) code, so a
      // top-level default can't actually call one; only top-level statements
      // are pre-collected before prop defaults resolve.
      const parser = new ComponentParser();
      const source = `
        <script>
          export let id = helper();
          {
            /** @returns {string} */
            function helper() { return "x"; }
          }
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.props[0]).toMatchObject({ name: "id", type: "any", value: "helper()" });
    });
  });

  test("keeps the JSDoc of a context variable typed from its initializer", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        import { setContext } from "svelte";

        /** Number of open panels */
        let count = $state(0);
        /**
         * Hidden from docs
         * @internal
         */
        let secret = $state(1);
        setContext("panels", { count, secret });

        /** Current label */
        let label = "x";
        setContext("label", label);
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.contexts?.find((context) => context.key === "panels")?.properties).toEqual([
      { name: "count", type: "number", description: "Number of open panels", optional: false },
      { name: "secret", type: "number", description: "Hidden from docs", optional: false, internal: true },
    ]);
    expect(result.contexts?.find((context) => context.key === "label")).toMatchObject({
      type: "string",
      description: "Current label",
    });
  });

  test("keeps a JSDoc block separated from its declaration by line or block comments", () => {
    const parser = new ComponentParser();
    const source = `
      <script context="module">
        /** Formats a value */
        // eslint-disable-next-line no-unused-vars
        export function format(value) {
          return String(value);
        }
      </script>

      <script>
        import { setContext } from "svelte";

        /** The size */
        // biome-ignore lint/style/useConst: it's a prop
        export let size = "md";

        /** The label */
        /* eslint-disable-next-line */
        export let label = "x";

        /**
         * Shared theme
         * @type {{ dark: boolean }}
         */
        // biome-ignore lint/style/useConst: reassigned elsewhere
        let theme = { dark: false };
        setContext("theme", theme);
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.props.map((prop) => [prop.name, prop.description])).toEqual([
      ["size", "The size"],
      ["label", "The label"],
    ]);
    expect(result.moduleExports.find((entry) => entry.name === "format")?.description).toBe("Formats a value");
    expect(result.contexts?.[0]).toMatchObject({ key: "theme", description: "Shared theme" });
  });

  test("doesn't attach a JSDoc block across code between two block comments", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        import { setContext } from "svelte";

        /** Not the theme's */
        /* a */ setup(); /* b */
        let theme = { dark: false };
        setContext("theme", theme);
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.contexts?.[0]?.description).toBeUndefined();
  });

  test("detects legacy syntax with TypeScript script", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        export let label: string;
      </script>

      <button>{label}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.syntaxMode).toBe("legacy");
    expect(result.scriptLanguage).toBe("ts");
  });

  test("detects runes syntax metadata", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        let { label }: { label: string } = $props();
      </script>

      <button>{label}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.syntaxMode).toBe("runes");
    expect(result.scriptLanguage).toBe("ts");
  });

  test("omits script language for markup-only components", () => {
    const parser = new ComponentParser();
    const source = "<button>Label</button>";

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.syntaxMode).toBe("legacy");
    expect(result).not.toHaveProperty("scriptLanguage");
  });

  test("detects runes syntax from a bare rune reference with no $props()", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        let count = $state(0);
      </script>

      <button onclick={() => count++}>{count}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.syntaxMode).toBe("runes");
  });

  test("explicit <svelte:options runes={true} /> forces runes mode", () => {
    const parser = new ComponentParser();
    const source = `
      <svelte:options runes={true} />
      <script>
        export let label;
      </script>

      <button>{label}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.syntaxMode).toBe("runes");
  });

  test("explicit <svelte:options runes={false} /> forces legacy mode", () => {
    const parser = new ComponentParser();
    const source = `
      <svelte:options runes={false} />
      <script>
        /** a plain local function that happens to share a rune's name */
        function describe() {
          return "legacy";
        }
      </script>

      <button>{describe()}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.syntaxMode).toBe("legacy");
  });

  test("a local declaration shadowing a rune name does not trigger runes mode", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        export let value;

        function render() {
          const $state = value * 2;
          return $state;
        }
      </script>

      <button>{render()}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.syntaxMode).toBe("legacy");
  });

  test("resolves a prop default wrapped in `as const`", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        export let type = "button" as const;
      </script>

      <button {type} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const prop = result.props.find((prop) => prop.name === "type");

    expect(prop?.type).toBe('"button"');
    expect(prop?.typeSource).toBe("default");
    expect(prop?.defaultValue).toMatchObject({ kind: "literal", value: "button" });
  });

  test("resolves a prop default wrapped in `satisfies` and a non-null assertion", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        export let count = (5 satisfies number)!;
      </script>

      <button>{count}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const prop = result.props.find((prop) => prop.name === "count");

    expect(prop?.type).toBe("number");
    expect(prop?.defaultValue).toMatchObject({ kind: "literal", value: 5 });
  });

  test("parses basic component exports", () => {
    const parser = new ComponentParser();
    const source = `  
      <script>
        export let label;
        export let disabled = false;
      </script>

      <button {disabled}>{label}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(2);
    const propNames = result.props.map((p) => p.name);
    expect(propNames).toContain("label");
    expect(propNames).toContain("disabled");
  });

  test("parses component with multiple exports", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        export let size = 'medium';
        export const buttonSizes = ['small', 'medium', 'large'];
      </script>

      <button class={size}>
        <slot />
      </button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(2);
    expect(result.props[0].name).toBe("size");
    expect(result.props[1].name).toBe("buttonSizes");
  });

  test("parses component with JSDoc comments", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** The text to display in the button */
        export let label;
        /** Controls the disabled state */
        export let disabled = false;
      </script>

      <button {disabled}>{label}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(2);

    const labelProp = result.props.find((p) => p.name === "label");
    expect(labelProp?.description).toBe("The text to display in the button");

    const disabledProp = result.props.find((p) => p.name === "disabled");
    expect(disabledProp?.description).toBe("Controls the disabled state");
  });

  test("parses @bindable JSDoc metadata and ignores invalid values", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Current value.
         * @bindable readonly
         */
        export let size = undefined;

        /**
         * Invalid binding documentation.
         * @bindable sideways
         */
        export let invalid = false;
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.props.find((p) => p.name === "size")?.binding).toBe("readonly");
    expect(result.props.find((p) => p.name === "size")?.description).toBe("Current value.");
    expect(result.props.find((p) => p.name === "invalid")?.binding).toBeUndefined();
  });

  test("preserves JSDoc when @ts-ignore is present", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Provide a writable store to maintain list selection.
         * @type {any}
         */
        // @ts-ignore
        export let selected = undefined;

        /**
         * Controls the disabled state
         * @type {boolean}
         */
        // @ts-expect-error - testing purposes
        export let disabled = false;

        /** This prop should work fine without ts-ignore */
        export let normal = true;
      </script>

      <div>{selected}</div>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(3);

    const selectedProp = result.props.find((p) => p.name === "selected");
    expect(selectedProp?.description).toBe("Provide a writable store to maintain list selection.");
    expect(selectedProp?.type).toBe("any");

    const disabledProp = result.props.find((p) => p.name === "disabled");
    expect(disabledProp?.description).toBe("Controls the disabled state");
    expect(disabledProp?.type).toBe("boolean");

    const normalProp = result.props.find((p) => p.name === "normal");
    expect(normalProp?.description).toBe("This prop should work fine without ts-ignore");
  });

  test("preserves JSDoc for module exports with @ts-ignore", () => {
    const parser = new ComponentParser();
    const source = `
      <script context="module">
        /**
         * A utility function that does something
         * @type {() => void}
         */
        // @ts-ignore
        export const utilityFunction = () => {};

        /**
         * A constant value
         */
        // @ts-ignore
        export const CONSTANT = 42;
      </script>

      <div>Test</div>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.moduleExports).toHaveLength(2);

    const funcExport = result.moduleExports.find((e) => e.name === "utilityFunction");
    expect(funcExport?.description).toBe("A utility function that does something");

    const constExport = result.moduleExports.find((e) => e.name === "CONSTANT");
    expect(constExport?.description).toBe("A constant value");
  });

  test("strips TypeScript directives only from top-level scripts", () => {
    const parser = new ComponentParser();
    const source = `
      <!-- <script> -->
      <p>Add <code>// @ts-ignore</code> above a line to silence it.</p>
      <script>
        /** The label */
        // @ts-ignore
        export let label = "";
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props.find((p) => p.name === "label")?.description).toBe("The label");
  });

  test("strips TypeScript directives before parsing", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * This JSDoc should be preserved
         * @type {string}
         */
        // @ts-ignore - this directive should be stripped
        export let prop1 = "test";

        /**
         * Another JSDoc comment
         * @type {number}
         */
        // @ts-expect-error - this should also be stripped
        export let prop2 = 42;

        /**
         * JSDoc without directive
         */
        export let prop3 = true;
      </script>

      <div>{prop1} {prop2} {prop3}</div>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(3);

    // All JSDoc comments should be preserved despite TypeScript directives
    const prop1 = result.props.find((p) => p.name === "prop1");
    expect(prop1?.description).toBe("This JSDoc should be preserved");
    expect(prop1?.type).toBe("string");

    const prop2 = result.props.find((p) => p.name === "prop2");
    expect(prop2?.description).toBe("Another JSDoc comment");
    expect(prop2?.type).toBe("number");

    const prop3 = result.props.find((p) => p.name === "prop3");
    expect(prop3?.description).toBe("JSDoc without directive");
  });

  test("keeps TypeScript directives inside a JSDoc example", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Value.
         * @example
         * \`\`\`js
         * // @ts-expect-error value must be a number
         * value = "x";
         * \`\`\`
         */
        // @ts-ignore
        export let value = 1;
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const value = result.props.find((p) => p.name === "value");
    expect(value?.description).toBe("Value.");
    expect(value?.tags).toEqual([
      {
        name: "example",
        body: '```js\n// @ts-expect-error value must be a number\nvalue = "x";\n```',
      },
    ]);
  });

  test("strips only the gutter's separator space from verbatim tag bodies", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Value.
         * @example
         * \`\`\`js
         * if (ready) {
         *   value = 2;
         * }
         * \`\`\`
         * @see first line
         * second line
         */
        export let value = 1;
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const value = result.props.find((p) => p.name === "value");
    expect(value?.tags).toEqual([
      { name: "example", body: "```js\nif (ready) {\n  value = 2;\n}\n```" },
      { name: "see", body: "first line\nsecond line" },
    ]);
  });

  test("handles slots and slot props", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        export let items = [];
      </script>

      <div>
        <slot name="header" {items} />
        <slot />
        <slot name="footer" count={items.length} />
      </div>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.slots).toHaveLength(3);

    const defaultSlot = result.slots.find((s) => s.default);
    expect(defaultSlot).toBeTruthy();

    const headerSlot = result.slots.find((s) => s.name === "header");
    expect(headerSlot?.slot_props).toContain("items");

    const footerSlot = result.slots.find((s) => s.name === "footer");
    expect(footerSlot?.slot_props).toContain("count");
    expect(footerSlot?.slot_props).toContain("count: any");
  });

  test("resolves dotted access slot prop type from @type annotation", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @type {{ value: string }} */
        let obj = { value: "hello" };
      </script>

      <slot prop={obj.value} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{ prop: string }");
  });

  test("resolves dotted access slot prop type from exported prop", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @type {{ x: number; y: number }} */
        export let point = { x: 0, y: 0 };
      </script>

      <slot coords={point.x} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{ coords: number }");
  });

  test("resolves dotted access with union types", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @type {{ status: "pending" | "done" | "error" }} */
        let state = { status: "pending" };
      </script>

      <slot current={state.status} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe('{ current: "pending" | "done" | "error" }');
  });

  test("resolves dotted access with nested object type", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @type {{ inner: { deep: number } }} */
        let nested = { inner: { deep: 42 } };
      </script>

      <slot data={nested.inner} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{ data: { deep: number } }");
  });

  test("resolves dotted access with optional property", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @type {{ label?: string }} */
        let config = {};
      </script>

      <slot text={config.label} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{ text: string }");
  });

  test("resolves dotted access with generic type", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @type {{ items: Array<string> }} */
        let data = { items: [] };
      </script>

      <slot list={data.items} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{ list: Array<string> }");
  });

  test("falls back to any for dotted access without type annotation", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        let obj = { value: "hello" };
      </script>

      <slot prop={obj.value} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{ prop: any }");
  });

  test("falls back to any for computed member access", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @type {{ value: string }} */
        let obj = { value: "hello" };
        let key = "value";
      </script>

      <slot prop={obj[key]} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{ prop: any }");
  });

  test("falls back to any for chained dotted access", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @type {{ a: { b: string } }} */
        let obj = { a: { b: "hello" } };
      </script>

      <slot prop={obj.a.b} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{ prop: any }");
  });

  test("resolves multiple dotted access slot props", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /** @type {{ name: string; count: number }} */
        let data = { name: "", count: 0 };
      </script>

      <slot a={data.name} b={data.count} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{\n  a: string;\n  b: number;\n}");
  });

  test("dotted access does not override @slot JSDoc types", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * @slot {{ item: CustomType }}
         */

        /** @type {{ value: string }} */
        let obj = { value: "hello" };
      </script>

      <slot item={obj.value} />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const slot = result.slots.find((s) => s.default);
    expect(slot?.slot_props).toBe("{ item: CustomType }");
  });

  test("treats @snippet as an alias for @slot", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * @snippet {{ item: string }}
         * @snippet {{ active: boolean }} header - Header snippet
         */
        let { children, header } = $props();
      </script>

      {@render children?.({ item: "value" })}
      {@render header?.({ active: true })}
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const defaultSlot = result.slots.find((s) => s.default);
    const headerSlot = result.slots.find((s) => s.name === "header");

    expect(defaultSlot?.slot_props).toBe("{ item: string }");
    expect(headerSlot?.slot_props).toBe("{ active: boolean }");
    expect(headerSlot?.description).toBe("Header snippet");
    expect(result.props.map((prop) => prop.name)).not.toContain("children");
    expect(result.props.map((prop) => prop.name)).not.toContain("header");
  });

  test("parses per-property TypeScript annotations for $props destructuring", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        let { foo, class: klass, bar = 1 }: { foo?: string; class: "primary" | "secondary"; bar: number } = $props();
      </script>

      <button class={klass}>{foo} {bar}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props.find((prop) => prop.name === "foo")?.type).toBe("string");
    expect(result.props.find((prop) => prop.name === "foo")?.isRequired).toBe(false);
    expect(result.props.find((prop) => prop.name === "class")?.type).toBe('"primary" | "secondary"');
    expect(result.props.find((prop) => prop.name === "class")?.isRequired).toBe(true);
    expect(result.props.find((prop) => prop.name === "bar")?.type).toBe("number");
  });

  test("parses named interface annotations for $props destructuring", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        interface Props {
          foo: string;
          bar?: number;
        }

        let { foo, bar }: Props = $props();
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props.find((prop) => prop.name === "foo")?.type).toBe("string");
    expect(result.props.find((prop) => prop.name === "foo")?.isRequired).toBe(true);
    expect(result.props.find((prop) => prop.name === "bar")?.type).toBe("number");
    expect(result.props.find((prop) => prop.name === "bar")?.isRequired).toBe(false);
  });

  test("parses typed whole-object $props captures", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        type Props = {
          title: string;
          disabled?: boolean;
        };

        let props: Props = $props();
      </script>

      <button disabled={props.disabled}>{props.title}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props.find((prop) => prop.name === "title")?.type).toBe("string");
    expect(result.props.find((prop) => prop.name === "title")?.isRequired).toBe(true);
    expect(result.props.find((prop) => prop.name === "disabled")?.type).toBe("boolean");
    expect(result.props.find((prop) => prop.name === "disabled")?.isRequired).toBe(false);
    expect(getParsedComponentTypeScriptMetadata(result)?.canonicalPropsType).toBe("Props");
  });

  test("preserves explicit TypeScript annotations for legacy export lets", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        export let title: string;
        export let count: number = 0;
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props.find((prop) => prop.name === "title")?.type).toBe("string");
    expect(result.props.find((prop) => prop.name === "count")?.type).toBe("number");
  });

  test("does not bleed declaration JSDoc across multiple $props bindings", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Shared doc should not bleed.
         * @type {string}
         */
        let {
          first = "",
          /**
           * Count prop.
           * @type {number}
           */
          count = 0,
        } = $props();
      </script>

      <div>{first} {count}</div>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props.find((prop) => prop.name === "first")?.description).toBeUndefined();
    expect(result.props.find((prop) => prop.name === "first")?.type).toBe("string");
    expect(result.props.find((prop) => prop.name === "count")?.description).toBe("Count prop.");
    expect(result.props.find((prop) => prop.name === "count")?.type).toBe("number");
  });

  test("aliases runes @event docs to callback props when no dispatched event exists", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Fired when a value is saved.
         * @event {{ id: string }} save
         * @event close
         */
        let { onsave, onclose } = $props();
      </script>

      <button
        onclick={() => {
          onsave?.({ id: "1" });
          onclose?.();
        }}
      >
        Save
      </button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.events).toHaveLength(0);
    expect(result.props.find((prop) => prop.name === "onsave")?.type).toBe("(detail: { id: string }) => void");
    expect(result.props.find((prop) => prop.name === "onsave")?.description).toBe("Fired when a value is saved.");
    expect(result.props.find((prop) => prop.name === "onsave")?.isFunction).toBe(true);
    expect(result.props.find((prop) => prop.name === "onclose")?.type).toBe("() => void");
  });

  test("merges a quoted @event name with the matching dispatch() call", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * @event {{ selected: boolean }} "change"
         */
        import { createEventDispatcher } from 'svelte';
        const dispatch = createEventDispatcher();

        function toggle() {
          dispatch('change', { selected: true });
        }
      </script>

      <button on:click={toggle}>Toggle</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].name).toBe("change");
    expect(result.events[0].detail).toBe("{ selected: boolean }");
  });

  test("handles component comments", () => {
    const parser = new ComponentParser();
    const source = `
      <!-- @component
        A button component with customizable styles and behaviors.
        Use this component for consistent button styling across the app.
      -->
      <script>
        export let label;
      </script>

      <button>{label}</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.componentComment).toContain("A button component with customizable styles");
  });

  test("adds source locations for component metadata", () => {
    const parser = new ComponentParser();
    const source = `<script>
  import { createEventDispatcher } from "svelte";
  /** Button label */
  export let label = "Save";
  const dispatch = createEventDispatcher();
  dispatch("ready");
</script>

<!-- @component Button docs -->
<button on:click>
  <slot name="icon" />
  {label}
</button>`;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.source).toMatchObject({ start: { line: 1, column: 0 }, end: { line: 13, column: 9 } });
    expect(result.componentCommentSource).toMatchObject({ start: { line: 9, column: 0 } });
    expect(result.props.find((prop) => prop.name === "label")?.source).toMatchObject({
      start: { line: 4, column: 2 },
    });
    expect(result.slots.find((slot) => slot.name === "icon")?.source).toMatchObject({
      start: { line: 11, column: 2 },
    });
    expect(result.events.find((event) => event.name === "click")?.source).toMatchObject({
      start: { line: 10 },
    });
    expect(result.events.find((event) => event.name === "ready")?.source).toMatchObject({
      start: { line: 6, column: 2 },
    });
  });

  test("throws an error for malformed source code", () => {
    const parser = new ComponentParser();
    const invalidSource = `
      <script>
        export default function {
          // Missing function name and parameters
          return <div />;
        }
      </script>
    `;

    expect(() => parser.parseSvelteComponent(invalidSource, diagnostics)).toThrow();
  });

  test("handles re-exported imports from context=module (issue #104)", () => {
    const parser = new ComponentParser();
    const source = `
      <script context="module" lang="ts">
        import { LayerCake, Svg, Html } from 'layercake';
        export { Svg, Html };
      </script>

      <script lang="ts">
        export let data;
      </script>

      <div>
        <slot />
      </div>
    `;

    // This should not throw "Cannot read properties of null (reading 'type')"
    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(1);
    expect(result.props[0].name).toBe("data");
  });

  test("handles re-exports in instance script (issue #104)", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        import { helper } from './utils';
        export { helper };
        export let data = [];
      </script>

      <div>{data.length}</div>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(1);
    expect(result.props[0].name).toBe("data");
  });

  test("parses @returns tag for function declarations", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Add a notification to the queue.
         * @param {string} notification
         * @returns {string} The notification id
         */
        export function add(notification) {
          return "id";
        }

        /**
         * Remove a notification by id.
         * @param {string} id
         * @returns {boolean} True if the notification was found and removed
         */
        export function remove(id) {
          return true;
        }

        /**
         * Get notification count.
         * @returns {number} The number of notifications
         */
        export function getCount() {
          return 0;
        }
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(3);

    const addProp = result.props.find((p) => p.name === "add");
    expect(addProp?.returnType).toBe("string");
    expect(addProp?.params).toHaveLength(1);
    expect(addProp?.params?.[0].name).toBe("notification");
    expect(addProp?.params?.[0].type).toBe("string");

    const removeProp = result.props.find((p) => p.name === "remove");
    expect(removeProp?.returnType).toBe("boolean");
    expect(removeProp?.params).toHaveLength(1);
    expect(removeProp?.params?.[0].name).toBe("id");
    expect(removeProp?.params?.[0].type).toBe("string");

    const getCountProp = result.props.find((p) => p.name === "getCount");
    expect(getCountProp?.returnType).toBe("number");
    expect(getCountProp?.params).toBeUndefined();
  });

  test("parses @return tag (alternative to @returns)", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Get user by id.
         * @param {string} id
         * @return {object} The user object
         */
        export function getUser(id) {
          return {};
        }
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(1);

    const getUserProp = result.props.find((p) => p.name === "getUser");
    expect(getUserProp?.returnType).toBe("object");
    expect(getUserProp?.params).toHaveLength(1);
  });

  test("parses @returns for module exports", () => {
    const parser = new ComponentParser();
    const source = `
      <script context="module">
        /**
         * Utility function that processes data.
         * @param {string} data
         * @returns {number} The processed result
         */
        export function process(data) {
          return 42;
        }
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.moduleExports).toHaveLength(1);

    const processExport = result.moduleExports.find((e) => e.name === "process");
    expect(processExport?.returnType).toBe("number");
    expect(processExport?.params).toHaveLength(1);
    expect(processExport?.params?.[0].name).toBe("data");
    expect(processExport?.params?.[0].type).toBe("string");
  });

  test("handles function with @param but no @returns (defaults to any)", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Log a message.
         * @param {string} message
         */
        export function log(message) {
          console.log(message);
        }
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(1);

    const logProp = result.props.find((p) => p.name === "log");
    expect(logProp?.returnType).toBeUndefined();
    expect(logProp?.params).toHaveLength(1);
    expect(logProp?.params?.[0].name).toBe("message");
  });

  test("handles function with @returns but no @param", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        /**
         * Get the current count.
         * @returns {number} The current count
         */
        export function getCount() {
          return 0;
        }
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(1);

    const getCountProp = result.props.find((p) => p.name === "getCount");
    expect(getCountProp?.returnType).toBe("number");
    expect(getCountProp?.params).toBeUndefined();
  });

  test("parses props from $props destructuring", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        let { title, count = 0 } = $props();
      </script>

      <div>{title} {count}</div>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(2);
    expect(result.props.find((p) => p.name === "title")?.isRequired).toBe(true);
    expect(result.props.find((p) => p.name === "count")?.value).toBe("0");
  });

  test("preserves public prop names for renamed $props bindings", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        let { class: klass } = $props();
      </script>

      <button class={klass}>click</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(1);
    expect(result.props[0]?.name).toBe("class");
  });

  test("treats $bindable defaults as optional reactive props", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        let { value = $bindable(0) } = $props();
      </script>

      <input bind:value />
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    const valueProp = result.props.find((p) => p.name === "value");
    expect(valueProp?.isRequired).toBe(false);
    expect(valueProp?.reactive).toBe(true);
    expect(valueProp?.value).toBe("0");
  });

  test("keeps callback props in props and out of events", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        let { onclick } = $props();
      </script>

      <button onclick={onclick}>click</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props.find((p) => p.name === "onclick")).toBeTruthy();
    expect(result.events).toHaveLength(0);
  });

  test("maps render tags to slots", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        let { item, children, header } = $props();
      </script>

      <section>
        {@render header?.({ title: item })}
        {@render children?.({ item })}
      </section>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.slots).toHaveLength(2);
    expect(result.props.map((prop) => prop.name)).toEqual(["item"]);
    expect(result.slots.find((slot) => slot.default)?.slot_props).toBe("{ item: any }");
    expect(result.slots.find((slot) => slot.name === "header")?.slot_props).toBe("{ title: any }");
  });

  test("maps render tags through typed whole-object $props captures", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        interface Props {
          item: string;
          children?: import("svelte").Snippet<[props: { item: string }]>;
        }

        let props: Props = $props();
      </script>

      {@render props.children?.({ item: props.item })}
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props.map((prop) => prop.name)).toEqual(["item"]);
    expect(result.slots.find((slot) => slot.default)?.slot_props).toBe("{ item: string }");
  });

  test("keeps positional snippet props in props when render args are not slot-shaped", () => {
    const parser = new ComponentParser();
    const source = `
      <script lang="ts">
        interface Props {
          row: import("svelte").Snippet<[item: string, index: number]>;
        }

        let { row }: Props = $props();
        let item = "hello";
        let index = 0;
      </script>

      {@render row?.(item, index)}
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props.find((prop) => prop.name === "row")?.type).toBe(
      'import("svelte").Snippet<[item: string, index: number]>',
    );
    expect(result.slots).toHaveLength(0);
  });

  test("does not invent props from whole-object $props captures", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        let props = $props();
      </script>

      <div>{props.value}</div>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.props).toHaveLength(0);
  });

  describe("@generics/@template JSDoc tags", () => {
    test("falls back to the name for a bare @generics tag with no constraint", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          /**
           * @generics Item
           */

          /** @type {Item} */
          export let value;
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.generics).toEqual(["Item", "Item"]);
    });

    test("warns when both @generics and @template declare the same name", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const parser = new ComponentParser();
      const source = `
        <script>
          /**
           * @template {string} Row
           * @generics {Row extends string = string} Row
           */

          /** @type {Row} */
          export let value;
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.generics).toEqual(["Row", "Row extends string = string"]);
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ kind: "generics-conflict", name: "Row" }));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Both @generics and @template tags are used"));

      warn.mockRestore();
    });

    test("warns when a name repeats across two @generics tags", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          /**
           * @generics {Row extends string = string} Row
           * @generics {Row extends number = number} Row
           */

          /** @type {Row} */
          export let value;
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ kind: "generics-conflict", name: "Row" }));
    });
  });

  describe("dispatch detail inference from variable initializers", () => {
    const detailOf = (source: string, name: string) =>
      new ComponentParser().parseSvelteComponent(source, diagnostics).events.find((event) => event.name === name)
        ?.detail;

    test("leaves a name a nested scope binds untyped", () => {
      const source = `
        <script>
          import { createEventDispatcher } from "svelte";
          const dispatch = createEventDispatcher();
          let label = "none";
          /** @type {number | string} */
          export let value = "";
          function rename(label) {
            dispatch("rename", { label });
            dispatch("label", label);
          }
          const update = ({ value }) => dispatch("value", value);
        </script>
      `;

      expect(detailOf(source, "rename")).toBe("{ label: any; }");
      expect(detailOf(source, "label")).toBeUndefined();
      expect(detailOf(source, "value")).toBeUndefined();
    });
  });

  describe("findVariableTypeAndDescription's JSDoc symbol table", () => {
    test("is not derailed by a regex literal containing a quote before the JSDoc block", () => {
      // A hand-rolled scanner that only knew about string literals would
      // treat the `"` inside `/"/` as an opening quote and skip past the
      // comment. The table reads the parser's own comment list instead.
      const parser = new ComponentParser();
      const source = `
        <script>
          import { setContext } from "svelte";
          const quote = /"/;
          /** @type {number} */
          let count = 0;
          setContext("k", { count });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({ name: "count", type: "number" });
    });

    test("resolves a JSDoc'd variable whose name is on a different line than its keyword", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          import { setContext } from "svelte";
          /**
           * @type {number}
           */
          const
            count = 0;
          setContext("counter", { count });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({ name: "count", type: "number" });
    });

    test("does not mistake comment-like text inside a string literal for a real comment", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          import { setContext } from "svelte";
          const trap = "look: /* not a real comment";
          /**
           * @type {number}
           */
          const value = 42;
          setContext("k", { value });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({ name: "value", type: "number" });
    });

    test("does not mistake a declaration-like string literal for a real declaration", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          import { setContext } from "svelte";
          const noise = "const value = 1";
          /**
           * @type {string}
           */
          const value = "real";
          setContext("k", { value });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({ name: "value", type: "string" });
    });

    test("a trailing same-line comment on a prior statement doesn't block the next declaration's own JSDoc", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          import { setContext } from "svelte";
          const a = 1; // trailing note about a, not JSDoc
          /**
           * @type {number}
           */
          const value = 2;
          setContext("k", { value });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({ name: "value", type: "number" });
    });

    test("resolves a JSDoc'd `export const` from a module script", () => {
      const parser = new ComponentParser();
      const source = `
        <script context="module">
          /**
           * Shared default count
           * @type {number}
           */
          export const defaultCount = 0;
        </script>
        <script>
          import { setContext } from "svelte";
          setContext("k", { defaultCount });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({
        name: "defaultCount",
        type: "number",
        description: "Shared default count",
      });
    });

    test("resolves a JSDoc'd arrow-function const", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          import { setContext } from "svelte";
          /**
           * Closes the modal
           * @type {() => void}
           */
          const close = () => {};
          setContext("k", { close });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({
        name: "close",
        type: "() => void",
        description: "Closes the modal",
      });
    });

    test("tolerates a blank line between the JSDoc block and the declaration", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          import { setContext } from "svelte";
          /**
           * @type {number}
           */

          const value = 5;
          setContext("k", { value });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({ name: "value", type: "number" });
    });

    test("attaches only the closest of two preceding JSDoc blocks", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          import { setContext } from "svelte";
          /**
           * @type {string}
           */
          /**
           * @type {number}
           */
          const value = 5;
          setContext("k", { value });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({ name: "value", type: "number" });
    });

    test("a plain (non-JSDoc) block comment does not supply a type", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          import { setContext } from "svelte";
          /* @type {string} */
          const value = compute();
          setContext("k", { value });
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.contexts?.[0].properties[0]).toMatchObject({ name: "value", type: "any" });
    });
  });

  describe("context values typed from their declarations", () => {
    const contextTypes = (script: string, lang = "") => {
      const result = new ComponentParser().parseSvelteComponent(`<script${lang}>${script}</script>`, diagnostics);
      return {
        types: Object.fromEntries((result.contexts?.[0].properties ?? []).map((prop) => [prop.name, prop.type])),
        anyTyped: (result.diagnostics ?? [])
          .filter((diagnostic) => diagnostic.kind === "context-any-type")
          .map((diagnostic) => diagnostic.name),
      };
    };

    test("types a function declaration like a function prop default", () => {
      const { types, anyTyped } = contextTypes(`
        import { setContext } from "svelte";
        function notifyOpen(id) {}
        function reset() {}
        /**
         * @param {string} id
         * @returns {boolean}
         */
        function claim(id) {
          return true;
        }
        setContext("k", { notifyOpen, reset, claim });
      `);
      expect(types).toEqual({
        notifyOpen: "(id: any) => any",
        reset: "(...args: any[]) => any",
        claim: "(id: string) => boolean",
      });
      expect(anyTyped).toEqual([]);
    });

    test("types an arrow const from its JSDoc params", () => {
      const { types } = contextTypes(`
        import { setContext } from "svelte";
        /** @param {number} index */
        const select = (index) => {};
        const label = () => "label";
        const close = /** @type {(force?: boolean) => void} */ (() => {});
        setContext("k", { select, label, close });
      `);
      expect(types).toEqual({
        select: "(index: number) => any",
        label: "(...args: any[]) => string",
        close: "(force?: boolean) => void",
      });
    });

    test("prefers a script variable's initializer over a nested function by the same name", () => {
      const { types } = contextTypes(`
        import { setContext } from "svelte";
        const reset = 0;
        function setup() {
          function reset() {}
        }
        setContext("k", { reset });
      `);
      expect(types).toEqual({ reset: "number" });
    });

    test("types a TS function from its annotations", () => {
      const { types } = contextTypes(
        `
        import { setContext } from "svelte";
        function select(id: string, focus?: boolean): void {}
        /** @param {number} index */
        const remove = (index: number) => {};
        setContext("k", { select, remove });
      `,
        ' lang="ts"',
      );
      expect(types).toEqual({
        select: "(id: string, focus?: boolean) => void",
        remove: "(index: number) => any",
      });
    });

    test("types svelte/store stores from their initial value", () => {
      const { types, anyTyped } = contextTypes(`
        import { setContext } from "svelte";
        import { writable, readable as constant, derived } from "svelte/store";
        /** @type {"sm" | "lg"} */
        export let size = "sm";
        export let disabled = false;
        const query = writable("");
        const sharedSize = writable(size);
        const sharedDisabled = writable(disabled);
        const highlightedId = writable(/** @type {string | null} */ (null));
        const items = writable([]);
        const label = writable(undefined);
        const count = constant(0);
        const hasItems = derived(items, () => true);
        const byId = derived(items, (_) => keyBy(_));
        const pushed = derived(items, (_, set) => set(1));
        setContext("k", { query, size: sharedSize, sharedDisabled, highlightedId, items, label, count, hasItems, byId, pushed });
      `);
      expect(types).toEqual({
        query: 'import("svelte/store").Writable<string>',
        size: 'import("svelte/store").Writable<"sm" | "lg">',
        sharedDisabled: 'import("svelte/store").Writable<boolean>',
        highlightedId: 'import("svelte/store").Writable<string | null>',
        items: 'import("svelte/store").Writable<any[]>',
        label: 'import("svelte/store").Writable<any>',
        count: 'import("svelte/store").Readable<number>',
        hasItems: 'import("svelte/store").Readable<boolean>',
        byId: 'import("svelte/store").Readable<any>',
        pushed: 'import("svelte/store").Readable<any>',
      });
      expect(anyTyped).toEqual([]);
    });

    test("types a store from its type argument", () => {
      const { types } = contextTypes(
        `
        import { setContext } from "svelte";
        import { writable, derived } from "svelte/store";
        const ids = writable<string[]>([]);
        const total = derived<typeof ids, number>(ids, (list) => list.length);
        setContext("k", { ids, total });
      `,
        ' lang="ts"',
      );
      expect(types).toEqual({
        ids: 'import("svelte/store").Writable<string[]>',
        total: 'import("svelte/store").Readable<number>',
      });
    });

    test("types a store written inline in the context object", () => {
      const { types } = contextTypes(`
        import { setContext } from "svelte";
        import { readable } from "svelte/store";
        setContext("k", { items: readable([]), max: readable(0) });
      `);
      expect(types).toEqual({
        items: 'import("svelte/store").Readable<any[]>',
        max: 'import("svelte/store").Readable<number>',
      });
    });

    test("leaves a value it can't derive as `any`", () => {
      const { types, anyTyped } = contextTypes(`
        import { setContext } from "svelte";
        import { uniqueId } from "./utils";
        import { writable } from "./my-store";
        const fallbackName = uniqueId();
        const custom = writable(0);
        setContext("k", { fallbackName, custom });
      `);
      expect(types).toEqual({ fallbackName: "any", custom: "any" });
      expect(anyTyped).toEqual(["fallbackName", "custom"]);
    });
  });

  test('ignores the generics script attribute without lang="ts" and reports syntax-skipped', () => {
    const parser = new ComponentParser();
    const source = `
      <script generics="Row extends DataTableRow = DataTableRow">
        export let row;
      </script>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);

    expect(result.generics).toBeNull();
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ kind: "syntax-skipped", name: "generics" }));
  });

  describe("type text with arrows and string literals", () => {
    test("reads a JSDoc EventDispatcher generic whose members contain an arrow", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          import { createEventDispatcher } from "svelte";
          /** @type {import('svelte').EventDispatcher<{ select: { onDone: () => void }; close: null }>} */
          const dispatch = createEventDispatcher();
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.events.map((event) => [event.name, "detail" in event ? event.detail : undefined])).toEqual([
        ["close", "null"],
        ["select", "{ onDone: () => void }"],
      ]);
    });

    test("resolves a dotted slot prop next to a function-typed member", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          /** @type {{ onClick: (e: MouseEvent) => void; label: string }} */
          export let item;
        </script>

        <slot text={item.label} />
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.slots.find((s) => s.default)?.slot_props).toBe("{ text: string }");
    });

    test("reads a JSDoc type containing an astral character", () => {
      const parser = new ComponentParser();
      const source = `
        <script>
          /** @type {"😀" | "b"} */
          export let icon = "b";
        </script>
      `;

      const result = parser.parseSvelteComponent(source, diagnostics);
      expect(result.props.find((prop) => prop.name === "icon")?.type).toBe('"😀" | "b"');
    });
  });

  test("types an `as const` default as TypeScript's const assertion does", () => {
    const source = `
      <script lang="ts">
        export let sizes = { sm: false, md: true } as const;
        export let items = ["a", "b"] as const;
        export let nested = { steps: [1, -2] } as const;
        export let size = "sm" as const;
        export let legacyAssertion = <const>["x"];
        export let widened = { sm: false };
        export const ids = { close: "close" } as const;
      </script>
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);
    const types = Object.fromEntries(props.map((prop) => [prop.name, prop.type]));

    expect(types).toEqual({
      sizes: "{ readonly sm: false; readonly md: true }",
      items: 'readonly ["a", "b"]',
      nested: "{ readonly steps: readonly [1, -2] }",
      size: '"sm"',
      legacyAssertion: 'readonly ["x"]',
      widened: "{ sm: boolean }",
      ids: '{ readonly close: "close" }',
    });
  });

  test("types an `as const` runes prop default as TypeScript's const assertion does", () => {
    const source = `
      <script lang="ts">
        let { sizes = { sm: false } as const, size = "sm" as const } = $props();
      </script>
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);
    const types = Object.fromEntries(props.map((prop) => [prop.name, prop.type]));

    expect(types).toEqual({ sizes: "{ readonly sm: false }", size: '"sm"' });
  });

  test("types a default cast with a JSDoc `@type` as the cast type", () => {
    const source = `
      <script>
        /** @typedef {{ id: string; label?: string }} Item */

        export let item = /** @type {Item} */ ({ id: "1" });
        export let items = /** @type {Item[]} */ ([]);
        export let plain = { id: "1" };
      </script>
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);
    const types = Object.fromEntries(props.map((prop) => [prop.name, prop.type]));

    expect(types).toEqual({ item: "Item", items: "Item[]", plain: "{ id: string }" });
  });

  test("types a default cast with `as` as the cast type", () => {
    const source = `
      <script lang="ts">
        type Item = { id: string; label?: string };

        export let item = { id: "1" } as Item;
        export let items = <Item[]>[];
        export let checked = { id: "1" } satisfies Item;
      </script>
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);
    const types = Object.fromEntries(props.map((prop) => [prop.name, prop.type]));

    expect(types).toEqual({ item: "Item", items: "Item[]", checked: "{ id: string }" });
  });

  test('types `bind:this` on an unknown element in a `namespace="mathml"` component as MathML', () => {
    const source = `
      <svelte:options namespace="mathml" />

      <script>
        export let ref = null;
      </script>

      <m-custom bind:this={ref} />
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);

    expect(props.find((prop) => prop.name === "ref")?.type).toBe("null | MathMLElement");
  });

  test("types `bind:this` on an imported component as its instance", () => {
    const source = `
      <script>
        import Modal from "./Modal.svelte";
        import { Tooltip } from "./ui";

        export let modalRef = null;
        export let tooltipRef = null;
        export let elementOrModal = null;
      </script>

      <Modal bind:this={modalRef} />
      <Tooltip bind:this={tooltipRef} />
      {#if modalRef}
        <div bind:this={elementOrModal} />
      {:else}
        <Modal bind:this={elementOrModal} />
      {/if}
    `;

    const result = new ComponentParser().parseSvelteComponent(source, diagnostics);
    const types = Object.fromEntries(result.props.map((prop) => [prop.name, prop.type]));
    const instance = (name: string) =>
      `(typeof ${name} extends abstract new (...args: any) => infer I ? I : typeof ${name} extends (...args: any) => infer R ? R : never)`;

    expect(types).toEqual({
      modalRef: `null | ${instance("Modal")}`,
      tooltipRef: `null | ${instance("Tooltip")}`,
      elementOrModal: `null | HTMLDivElement | ${instance("Modal")}`,
    });
    expect(getParsedComponentTypeScriptMetadata(result)?.typeImportStatements).toEqual([
      'import type { default as Modal } from "./Modal.svelte";',
      'import type { Tooltip } from "./ui";',
    ]);
  });

  test("leaves `bind:this` on a component it can't name untyped", () => {
    const source = `
      <script>
        import * as UI from "./ui";

        export let namespacedRef = null;
        export let selfRef = null;
      </script>

      <UI.Modal bind:this={namespacedRef} />
      <svelte:self bind:this={selfRef} />
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);

    expect(props.map((prop) => prop.type)).toEqual([undefined, undefined]);
  });

  test("types runes props from a JSDoc object type with an index signature", () => {
    const parse = (source: string) =>
      Object.fromEntries(
        new ComponentParser().parseSvelteComponent(source, diagnostics).props.map((prop) => [prop.name, prop.type]),
      );

    expect(
      parse(`
        <script>
          /** @type {{ size?: "sm" | "md"; [key: string]: any }} */
          let { size, ...rest } = $props();
        </script>
      `),
    ).toEqual({ size: '"sm" | "md"' });
    expect(
      parse(`
        <script>
          /** @type {{ size?: "sm" | "md"; label: string; [key: string]: unknown }} */
          let { size, label } = $props();
        </script>
      `),
    ).toEqual({ size: '"sm" | "md"', label: "string" });
    expect(
      parse(`
        <script>
          /** @typedef {{ size?: "sm" | "md"; [key: string]: any }} Props */
          /** @type {Props} */
          let { size, ...rest } = $props();
        </script>
      `),
    ).toEqual({ size: '"sm" | "md"' });
  });

  test("types `bind:this={refs[i]}` on an element as an array of the element", () => {
    const source = `
      <script>
        export let itemRefs = [];
        export let keyedRefs = [];
        export let items = ["a"];
      </script>

      {#each items as item, i}
        <li bind:this={itemRefs[i]}>{item}</li>
        <span bind:this={keyedRefs[item]} />
      {/each}
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);
    const byName = Object.fromEntries(props.map((prop) => [prop.name, prop]));

    expect(byName.itemRefs).toMatchObject({ type: "(null | HTMLLIElement)[]", typeSource: "inferred", reactive: true });
    expect(byName.keyedRefs).toMatchObject({ type: "(null | HTMLSpanElement)[]", reactive: true });
    expect(byName.items).toMatchObject({ type: "string[]", reactive: false });
  });

  test("types `bind:this={refs[i]}` inside `<svg>` as an array of the SVG element", () => {
    const source = `
      <script>
        export let circleRefs = [];
      </script>

      <svg>
        {#each [1, 2] as r, i}
          <circle bind:this={circleRefs[i]} {r} />
        {/each}
      </svg>
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);

    expect(props[0]?.type).toBe("(null | SVGCircleElement)[]");
  });

  test("types `bind:this={refs[i]}` on an imported component as an array of its instance", () => {
    const source = `
      <script>
        import Modal from "./Modal.svelte";

        export let modalRefs = [];
      </script>

      {#each [1, 2] as _, i}
        <Modal bind:this={modalRefs[i]} />
      {/each}
    `;

    const result = new ComponentParser().parseSvelteComponent(source, diagnostics);

    expect(result.props[0]?.type).toBe(
      "(null | (typeof Modal extends abstract new (...args: any) => infer I ? I : typeof Modal extends (...args: any) => infer R ? R : never))[]",
    );
    expect(getParsedComponentTypeScriptMetadata(result)?.typeImportStatements).toEqual([
      'import type { default as Modal } from "./Modal.svelte";',
    ]);
  });

  test("types a runes `$bindable([])` prop bound by index as an array of the element", () => {
    const source = `
      <script>
        let { itemRefs = $bindable([]), items = [] } = $props();
      </script>

      {#each items as item, i}
        <li bind:this={itemRefs[i]}>{item}</li>
      {/each}
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);

    expect(props.find((prop) => prop.name === "itemRefs")?.type).toBe("(null | HTMLLIElement)[]");
  });

  test("leaves the type of a prop bound both directly and by index", () => {
    const source = `
      <script>
        export let refs = [];
      </script>

      <div bind:this={refs} />
      {#each [1] as _, i}
        <li bind:this={refs[i]} />
      {/each}
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);

    expect(props[0]).toMatchObject({ type: "any[]", reactive: true });
  });

  test("leaves the type of a prop bound by index when its default isn't an array", () => {
    const source = `
      <script>
        export let refsById = {};
      </script>

      {#each [{ id: "a" }] as item}
        <li bind:this={refsById[item.id]} />
      {/each}
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);

    expect(props[0]).toMatchObject({ type: "{}", reactive: true });
  });

  test("doesn't type a prop from `bind:this` on a non-indexed member, a nested member, or a local", () => {
    const source = `
      <script>
        export let named = [];
        export let nested = { a: [] };
        let local = [];
      </script>

      <div bind:this={named.first} />
      {#each [1] as _, i}
        <li bind:this={nested.a[i]} />
        <li bind:this={local[i]} />
      {/each}
    `;

    const { props } = new ComponentParser().parseSvelteComponent(source, diagnostics);
    const byName = Object.fromEntries(props.map((prop) => [prop.name, prop]));

    // Still reactive: the binding writes into the prop.
    expect(byName.named).toMatchObject({ type: "any[]", reactive: true });
    expect(byName.nested).toMatchObject({ type: "{ a: any[] }", reactive: true });
  });

  describe("rest props spread through a local object", () => {
    const restPropsOf = (source: string) => new ComponentParser().parseSvelteComponent(source, diagnostics).rest_props;

    test("follows a `$:` object that spreads $$restProps onto a dynamic element", () => {
      const source = `
        <script>
          export let tag = "div";
          $: props = { ...$$restProps, class: ["stack", $$restProps.class].join(" ") };
        </script>

        <svelte:element this={tag} {...props}><slot /></svelte:element>
      `;

      expect(restPropsOf(source)).toEqual({ type: "Element", name: "svelte:element" });
    });

    test("follows a const object, through a type cast, onto an element or component", () => {
      const element = `
        <script lang="ts">
          const attrs = { role: "group", ...$$restProps } as Record<string, unknown>;
        </script>

        <div {...attrs} />
      `;
      const component = `
        <script>
          import Button from "./Button.svelte";
          let attrs = { ...$$restProps, kind: "ghost" };
        </script>

        <Button {...attrs} />
      `;

      expect(restPropsOf(element)).toEqual({ type: "Element", name: "div" });
      expect(restPropsOf(component)).toEqual({ type: "InlineComponent", name: "Button" });
    });

    test("follows a runes `$derived` object that spreads the rest local", () => {
      const source = `
        <script>
          import Child from "./Child.svelte";
          /** @snippet {{}} title */
          let { size = "md", ...rest } = $props();
          const props = $derived({ ...rest, class: \`btn-\${size}\` });
          const childProps = $derived({ ...rest });
        </script>

        <Child {...childProps} />
        <button {...props}>Go</button>
      `;

      const result = new ComponentParser().parseSvelteComponent(source, diagnostics);

      expect(result.rest_props).toEqual({ type: "Element", name: "button" });
      // The rest object carries snippet props, so `<Child>` may render `title`.
      expect(result.diagnostics?.some((d) => d.kind === "slot-not-rendered")).toBe(false);
    });

    test("doesn't follow chains, calls, objects without a rest spread, or shadowed names", () => {
      const sources = [
        `<script>
          $: base = { ...$$restProps };
          $: props = { ...base, class: "x" };
        </script>
        <div {...props} />`,
        `<script>
          const props = Object.assign({}, $$restProps);
        </script>
        <div {...props} />`,
        `<script>
          $: props = { ...$$props, class: "x" };
        </script>
        <div {...props} />`,
        `<script>
          export let items = [];
          $: props = { ...$$restProps };
        </script>
        {#each items as props}<div {...props} />{/each}`,
        `<script>
          function build() {
            const props = { ...$$restProps };
            return props;
          }
        </script>
        <div {...props} />`,
      ];

      expect(sources.map(restPropsOf)).toEqual([undefined, undefined, undefined, undefined, undefined]);
    });

    test("lets an explicit @restProps tag win", () => {
      const source = `
        <script>
          /** @restProps {span} */
          $: props = { ...$$restProps };
        </script>

        <div {...props} />
      `;

      expect(restPropsOf(source)).toMatchObject({ type: "Element", name: "span" });
    });
  });

  describe("rest props of a `<svelte:element>` whose tag is a type parameter", () => {
    const restPropsOf = (source: string) => new ComponentParser().parseSvelteComponent(source, diagnostics).rest_props;

    test("types them from the type parameter", () => {
      expect(
        restPropsOf(`
          <script>
            /** @template {keyof HTMLElementTagNameMap} [Tag="div"] */

            /** @type {Tag} */
            export let tag = "div";
          </script>

          <svelte:element this={tag} {...$$restProps}><slot /></svelte:element>
        `),
      ).toEqual({ type: "Element", name: "svelte:element", thisType: "Tag" });
    });

    test("types them from a runes prop's type parameter", () => {
      expect(
        restPropsOf(`
          <script lang="ts" generics="Tag extends keyof HTMLElementTagNameMap = 'div'">
            let { tag = "div" as Tag, ...rest }: { tag?: Tag; [key: string]: unknown } = $props();
          </script>

          <svelte:element this={tag} {...rest} />
        `),
      ).toEqual({ type: "Element", name: "svelte:element", thisType: "Tag" });
    });

    test("leaves an unconstrained type parameter alone, since it may not be a tag name", () => {
      expect(
        restPropsOf(`
          <script>
            /** @template [Tag="div"] */

            /** @type {Tag} */
            export let tag = "div";
          </script>

          <svelte:element this={tag} {...$$restProps} />
        `),
      ).toEqual({ type: "Element", name: "svelte:element" });
    });
  });

  describe("context values that aren't objects or typed variables", () => {
    const contextsOf = (script: string) => {
      const result = new ComponentParser().parseSvelteComponent(`<script>${script}</script>`, diagnostics);
      return {
        contexts: (result.contexts ?? []).map(({ key, type }) => ({ key, type })),
        diagnostics: (result.diagnostics ?? []).map((diagnostic) => diagnostic.kind),
      };
    };

    test("types a store passed as the whole value", () => {
      expect(
        contextsOf(`
          import { setContext } from "svelte";
          import { readonly, writable } from "svelte/store";
          const level = writable(1);
          setContext("count", writable(0));
          setContext("level", readonly(level));
        `),
      ).toEqual({
        contexts: [
          { key: "count", type: 'import("svelte/store").Writable<number>' },
          { key: "level", type: 'import("svelte/store").Readable<number>' },
        ],
        diagnostics: [],
      });
    });

    test("types a context cleared with `undefined` or `null` without a diagnostic", () => {
      expect(
        contextsOf(`
          import { setContext } from "svelte";
          setContext("parent", undefined);
          setContext("group", null);
        `),
      ).toEqual({
        contexts: [
          { key: "parent", type: "undefined" },
          { key: "group", type: "null" },
        ],
        diagnostics: [],
      });
    });
  });

  test("types `bind:this` on a `<svelte:element>` from its tag type parameter", () => {
    const { props } = new ComponentParser().parseSvelteComponent(
      `
        <script>
          /** @template {keyof HTMLElementTagNameMap} [Tag="div"] */

          /** @type {Tag} */
          export let tag = "div";
          export let ref = null;
        </script>

        <svelte:element this={tag} bind:this={ref} />
      `,
      diagnostics,
    );

    expect(props.find((prop) => prop.name === "ref")?.type).toBe("null | HTMLElementTagNameMap[Tag]");
  });

  test("locates a rest props spread onto a component", () => {
    const result = new ComponentParser().parseSvelteComponent(
      `<script>\n  import Link from "./Link.svelte";\n</script>\n\n<Link {...$$restProps} />\n`,
      diagnostics,
    );
    const diagnostic = result.diagnostics?.find(({ kind }) => kind === "rest-props-unresolved");

    expect(diagnostic?.source?.start).toEqual({ line: 5, column: 6 });
  });

  test("doesn't flag rest props spread onto the component `@extendProps` names", () => {
    const restPropsDiagnostics = (target: string) =>
      new ComponentParser()
        .parseSvelteComponent(
          `
            <script>
              /** @extendProps {"./Link.svelte"} LinkProps */
              import Link from "./Link.svelte";
              import Button from "./Button.svelte";
            </script>

            <${target} {...$$restProps} />
          `,
          diagnostics,
        )
        .diagnostics?.filter(({ kind }) => kind === "rest-props-unresolved") ?? [];

    expect(restPropsDiagnostics("Link")).toEqual([]);
    expect(restPropsDiagnostics("Button")).toHaveLength(1);
  });

  test("types a context property from its JSDoc", () => {
    const result = new ComponentParser().parseSvelteComponent(
      `
        <script>
          import { setContext } from "svelte";
          import { noop } from "./utils";

          setContext("group", {
            /**
             * Adds an item to the group.
             * @type {(id: string) => void}
             */
            register: noop,
          });
        </script>
      `,
      diagnostics,
    );

    expect(result.contexts?.[0]?.properties).toEqual([
      { name: "register", type: "(id: string) => void", description: "Adds an item to the group.", optional: false },
    ]);
    expect(result.diagnostics?.filter(({ kind }) => kind === "context-any-type")).toEqual([]);
  });
});
