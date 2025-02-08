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
