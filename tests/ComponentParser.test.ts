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
});
