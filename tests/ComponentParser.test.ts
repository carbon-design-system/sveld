import ComponentParser from "../src/ComponentParser";

describe("ComponentParser", () => {
  const diagnostics = {
    moduleName: "TestComponent",
    filePath: "/test/TestComponent.svelte",
  };

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
    expect(slot?.slot_props).toBe("{ a: string, b: number }");
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

  test("handles dispatched events", () => {
    const parser = new ComponentParser();
    const source = `
      <script>
        import { createEventDispatcher } from 'svelte';
        const dispatch = createEventDispatcher();
        
        function handleClick() {
          dispatch('click', { detail: 'clicked' });
        }
      </script>

      <button on:click={handleClick}>Click me</button>
    `;

    const result = parser.parseSvelteComponent(source, diagnostics);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("dispatched");
    expect(result.events[0].name).toBe("click");
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
});
