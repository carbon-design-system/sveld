import ComponentParser from "../src/ComponentParser";
import { getParsedComponentTypeScriptMetadata } from "../src/parsed-component-metadata";

describe("ComponentParser", () => {
  const diagnostics = {
    moduleName: "TestComponent",
    filePath: "/test/TestComponent.svelte",
  };

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

  test("reads a quoted @event name with a space up to its closing quote", () => {
    const source = `<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  /** @event {string} "value change" Fires after the value settles. */
</script>

<button on:click={() => dispatch("value change", "")}>Change</button>`;

    const [event] = new ComponentParser().parseSvelteComponent(source, diagnostics).events;
    expect(event).toMatchObject({
      name: "value change",
      detail: "string",
      description: "Fires after the value settles.",
    });
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

  test("locates a rest props spread onto a component", () => {
    const result = new ComponentParser().parseSvelteComponent(
      `<script>\n  import Link from "./Link.svelte";\n</script>\n\n<Link {...$$restProps} />\n`,
      diagnostics,
    );
    const diagnostic = result.diagnostics?.find(({ kind }) => kind === "rest-props-unresolved");

    expect(diagnostic?.source?.start).toEqual({ line: 5, column: 6 });
  });
});
