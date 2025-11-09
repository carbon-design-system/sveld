const button = {
  name: "Button",
  moduleName: "Button",
  code: `<script>
  export let type = "button";
  export let primary = false;
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>`,
};

const dispatched_events = {
  name: "Dispatched events",
  moduleName: "DispatchedEvents",
  code: `<script>
  import { onDestroy, createEventDispatcher } from "svelte";

  const dispatcher = createEventDispatcher();

  onDestroy(() => {
    dispatcher("destroy");
    dispatcher("destroy--component");
    dispatcher("destroy:component");
  });
</script>

<button type="button" />
<h1
  on:mouseover={() => {
    dispatcher("hover", { h1: true });
  }}
>
  <slot />
</h1>
`,
};

const forwarded_events = {
  name: "Forwarded events",
  moduleName: "ForwardedEvents",
  code: `<button type="button" on:click on:focus on:blur />
<h1 on:mouseover on:mouseover={() => {}}>
  <slot />
</h1>
`,
};

const generics = {
  name: "Generics",
  moduleName: "Generics",
  code: `<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @typedef {Exclude<keyof Row, "id">} DataTableKey<Row>
   * @typedef {{ key: DataTableKey<Row>; value: string; }} DataTableHeader<Row=DataTableRow>
   * @template {DataTableRow} <Row extends DataTableRow = DataTableRow>
   * @generics {Row extends DataTableRow = DataTableRow} Row
   */

  /** @type {ReadonlyArray<DataTableHeader<Row>>} */
   export let headers = [];

  /** @type {ReadonlyArray<Row>} */
  export let rows = [];
</script>

<slot {headers} {rows} />
`,
};

const dispatched_events_annotated = {
  name: "Dispatched events (annotated)",
  moduleName: "DispatchedEventsAnnotated",
  code: `<script>
  /**
   * Form value structure
   * @typedef {object} FormValues
   * @property {string} value - The current input value
   * @property {boolean} [valid] - Whether the value passes validation
   */

  /**
   * Fired when the input value changes
   * @event {FormValues} change
   */

  /**
   * Fired when the form is submitted
   * @event {FormValues} submit
   */

  /**
   * Fired when validation fails
   * @event {{ errors: string[]; value: string }} error
   */

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /**
   * Current input value
   * @type {string}
   */
  export let value = "";

  /**
   * Minimum length for validation
   * @type {number}
   */
  export let minLength = 3;

  function validate(val) {
    const errors = [];
    if (val.length < minLength) {
      errors.push(\`Must be at least \${minLength} characters\`);
    }
    return errors;
  }

  function handleInput() {
    const errors = validate(value);
    if (errors.length > 0) {
      dispatch("error", { errors, value });
    } else {
      dispatch("change", { value, valid: true });
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const errors = validate(value);
    if (errors.length === 0) {
      dispatch("submit", { value, valid: true });
    }
  }
</script>

<form on:submit={handleSubmit}>
  <input
    type="text"
    bind:value
    on:input={handleInput}
  />
  <button type="submit">Submit</button>
</form>`,
};

const aliased_props = {
  name: "Aliased props",
  moduleName: "AliasedProps",
  code: `<script>
  let className = "test";
  /**
   * Just your average CSS class string.
   * @type {string|null}
   */
  export { className as class };
</script>

{className}
`,
};

const named_slots = {
  name: "Named slots",
  moduleName: "NamedSlots",
  code: `<script>
  /**
   * @slot {{ prop: number; doubled: number; }}
   * @slot {{}} title
   * @slot {{ prop: number }} body - Customize the paragraph text.
   */

  export let prop = 0;
</script>

<h1>
  <slot {prop} doubled={prop * 2} />
  <slot name="title" />
</h1>

<p>
  <slot name="body" {prop} />
</p>
`,
};

const rest_props = {
  name: "Explicit rest props",
  moduleName: "ExplicitRestProps",
  code: `<script>
  /**
 * Multiple elements
 * @restProps {div | p}
 */

export let toggle = false;
  </script>

{#if toggle}
  <div {...$$restProps} />
{/if}

{#if !toggle}
  <p {...$$restProps} />
{/if}
`,
};

const component_comments = {
  name: "Component comments",
  moduleName: "ComponentComments",
  code: `<!-- @component
@example
<Button>
  Text
</Button>
-->
<button>
  <slot />
</button>
`,
};

const function_with_params = {
  name: "Functions with @type and @param",
  moduleName: "FunctionsWithParams",
  code: `<script>
  /**
   * Custom types for the component
   * @typedef {string | number} NodeId
   * @typedef {{ expand?: boolean; select?: boolean; focus?: boolean }} ShowNodeOptions
   */

  /**
   * Programmatically show a node by its ID.
   * By default, the matching node will be expanded, selected, and focused.
   * Use the options parameter to customize this behavior.
   * @type {(id: NodeId, options?: ShowNodeOptions) => void}
   * @param {NodeId} id - The unique identifier of the node to show
   * @param {ShowNodeOptions} [options] - Configuration options for showing the node
   * @example
   * // Show node with all default behaviors
   * showNode("node-1");
   *
   * // Show node but don't select it
   * showNode("node-2", { select: false });
   *
   * // Only expand, don't select or focus
   * showNode(123, { select: false, focus: false });
   */
  export function showNode(id, options = {}) {
    const { expand = true, select = true, focus = true } = options;
    // Implementation here
  }

  /**
   * Search for nodes matching the given query.
   * Returns an array of matching node IDs and their relevance scores.
   * @type {(query: string, limit?: number) => Array<{ id: NodeId; score: number }>}
   * @param {string} query - The search query string
   * @param {number} [limit=10] - Maximum number of results to return
   * @example
   * // Search for nodes with default limit
   * const results = searchNodes("hello");
   *
   * // Search with custom limit
   * const topThree = searchNodes("world", 3);
   */
  export function searchNodes(query, limit = 10) {
    // Implementation here
    return [];
  }

  /**
   * Updates multiple node properties in a single batch operation.
   * More efficient than updating nodes individually.
   * @type {(updates: Record<NodeId, Partial<{ label: string; visible: boolean }>>) => Promise<void>}
   * @param {Record<NodeId, object>} updates - Map of node IDs to property updates
   * @example
   * // Update multiple nodes at once
   * await batchUpdateNodes({
   *   "node-1": { label: "Updated" },
   *   "node-2": { visible: false },
   *   "node-3": { label: "New", visible: true }
   * });
   */
  export async function batchUpdateNodes(updates) {
    // Implementation here
  }
</script>

<div>
  <slot />
</div>
`,
};

export default [
  button,
  dispatched_events,
  dispatched_events_annotated,
  forwarded_events,
  generics,
  aliased_props,
  rest_props,
  named_slots,
  component_comments,
  function_with_params,
];
