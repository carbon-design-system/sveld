type Example = {
  name: string;
  moduleName: string;
  code: string;
};

const buttonRunes: Example = {
  name: "Button",
  moduleName: "ButtonRunes",
  code: `<script>
  let {
    type = "button",
    primary = false,
    children,
    onclick,
    ...restProps
  } = $props();
</script>

<button
  {...restProps}
  {type}
  class:primary
  onclick={onclick}
>
  {#if children}
    {@render children()}
  {:else}
    Click me
  {/if}
</button>`,
};

const typeScriptPropsRunes: Example = {
  name: "TypeScript props",
  moduleName: "TypeScriptPropsRunes",
  code: `<script lang="ts">
  interface NoticeProps {
    message: string;
    tone?: "info" | "warning";
  }

  type ActionProps = {
    onconfirm?: (detail: {
      message: string;
      tone: NoticeProps["tone"];
    }) => void;
  };

  let {
    message,
    tone = "info",
    onconfirm,
  }: NoticeProps & ActionProps = $props();

  function handleClick() {
    onconfirm?.({ message, tone });
  }
</script>

<button
  type="button"
  class:tone-warning={tone === "warning"}
  onclick={handleClick}
>
  {message}
</button>`,
};

const dispatchedEventsRunes: Example = {
  name: "Callback events",
  moduleName: "CallbackEventsRunes",
  code: `<script>
  import { onDestroy } from "svelte";

  let { children, ondestroy, onhover } = $props();

  onDestroy(() => {
    ondestroy?.();
  });

  function handleMouseOver() {
    onhover?.({ h1: true });
  }
</script>

<button type="button" />
<h1 onmouseover={handleMouseOver}>
  {@render children?.()}
</h1>
`,
};

const dispatchedEventsAnnotatedRunes: Example = {
  name: "Callback events (annotated)",
  moduleName: "CallbackEventsAnnotatedRunes",
  code: `<script>
  /**
   * Form value structure
   * @typedef {object} FormValues
   * @property {string} value - The current input value
   * @property {boolean} [valid] - Whether the value passes validation
   */

  let {
    value = $bindable(""),
    minLength = 3,
    /** @type {(detail: FormValues) => void} Fired when the input value changes */
    onchange,
    /** @type {(detail: FormValues) => void} Fired when the form is submitted */
    onsubmit,
    /** @type {(detail: { errors: string[]; value: string }) => void} Fired when validation fails */
    onerror,
  } = $props();

  function validate(val) {
    const errors = [];
    if (val.length < minLength) {
      errors.push(
        \`Must be at least \${minLength} characters\`,
      );
    }
    return errors;
  }

  function handleInput() {
    const errors = validate(value);
    if (errors.length > 0) {
      onerror?.({ errors, value });
    } else {
      onchange?.({ value, valid: true });
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const errors = validate(value);
    if (errors.length === 0) {
      onsubmit?.({ value, valid: true });
    }
  }
</script>

<form onsubmit={handleSubmit}>
  <input
    type="text"
    bind:value
    oninput={handleInput}
  />
  <button type="submit">Submit</button>
</form>`,
};

const forwardedEventsRunes: Example = {
  name: "Forwarded events",
  moduleName: "ForwardedEventsRunes",
  code: `<script>
  let {
    onclick,
    onfocus,
    onblur,
    onmouseover,
    children,
  } = $props();
</script>

<button
  type="button"
  onclick={onclick}
  onfocus={onfocus}
  onblur={onblur}
/>
<h1 onmouseover={onmouseover}>
  {@render children?.()}
</h1>
`,
};

const genericsRunes: Example = {
  name: "Generics",
  moduleName: "GenericsRunes",
  code: `<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @typedef {Exclude<keyof Row, "id">} DataTableKey<Row>
   * @typedef {{ key: DataTableKey<Row>; value: string; }} DataTableHeader<Row=DataTableRow>
   * @template {DataTableRow} <Row extends DataTableRow = DataTableRow>
   * @generics {Row extends DataTableRow = DataTableRow} Row
   */

  /** @type {ReadonlyArray<DataTableHeader<Row>>} */
  let {
    headers = [],
    rows = [],
    children,
  } = $props();
</script>

{@render children?.({
  headers,
  rows,
})}
`,
};

const aliasedPropsRunes: Example = {
  name: "Aliased props",
  moduleName: "AliasedPropsRunes",
  code: `<script>
  /**
   * Just your average CSS class string.
   * @type {string|null}
   */
  let { class: className = "test" } = $props();
</script>

{className}
`,
};

const namedSnippetsRunes: Example = {
  name: "Named snippets",
  moduleName: "NamedSnippetsRunes",
  code: `<script>
  /**
   * @snippet {{ prop: number; doubled: number; }}
   * @snippet {{}} title
   * @snippet {{ prop: number }} body - Customize the paragraph text.
   */

  let {
    prop = 0,
    children,
    title,
    body,
  } = $props();
</script>

<h1>
  {@render children?.({
    prop,
    doubled: prop * 2,
  })}
  {@render title?.()}
</h1>

<p>
  {@render body?.({ prop })}
</p>
`,
};

const restPropsRunes: Example = {
  name: "Explicit rest props",
  moduleName: "ExplicitRestPropsRunes",
  code: `<script>
  /**
   * Multiple elements
   * @restProps {div | p}
   */

  let {
    toggle = false,
    ...restProps
  } = $props();
</script>

{#if toggle}
  <div {...restProps} />
{/if}

{#if !toggle}
  <p {...restProps} />
{/if}
`,
};

const componentCommentsRunes: Example = {
  name: "Component comments",
  moduleName: "ComponentCommentsRunes",
  code: `<!-- @component
@example
<Button>
  Text
</Button>
-->
<script>
  let { children } = $props();
</script>

<button>
  {@render children?.()}
</button>
`,
};

const functionWithParamsRunes: Example = {
  name: "Functions with @type and @param",
  moduleName: "FunctionsWithParamsRunes",
  code: `<script>
  /**
   * Custom types for the component
   * @typedef {string | number} NodeId
   * @typedef {{ expand?: boolean; select?: boolean; focus?: boolean }} ShowNodeOptions
   */

  let { children } = $props();

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
    const {
      expand = true,
      select = true,
      focus = true,
    } = options;
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
  {@render children?.()}
</div>
`,
};

const buttonLegacy: Example = {
  name: "Button (non-Runes)",
  moduleName: "ButtonLegacy",
  code: `<script>
  export let type = "button";
  export let primary = false;
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>`,
};

const typeScriptPropsLegacy: Example = {
  name: "TypeScript props (non-Runes)",
  moduleName: "TypeScriptPropsLegacy",
  code: `<script lang="ts">
  type NoticeTone = "info" | "warning";

  interface NoticeMeta {
    source: "user" | "system";
    retries?: number;
  }

  export let message: string;
  export let tone: NoticeTone = "info";
  export let meta: NoticeMeta = { source: "user" };
  export let onconfirm:
    | ((detail: {
        message: string;
        tone: NoticeTone;
        meta: NoticeMeta;
      }) => void)
    | undefined;

  function handleClick() {
    onconfirm?.({ message, tone, meta });
  }
</script>

<button
  type="button"
  onclick={handleClick}
>
  {message} ({meta.source})
</button>`,
};

const dispatchedEventsLegacy: Example = {
  name: "Dispatched events (non-Runes)",
  moduleName: "DispatchedEventsLegacy",
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

const genericsLegacy: Example = {
  name: "Generics (non-Runes)",
  moduleName: "GenericsLegacy",
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

const dispatchedEventsAnnotatedLegacy: Example = {
  name: "Dispatched events (annotated) (non-Runes)",
  moduleName: "DispatchedEventsAnnotatedLegacy",
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

const forwardedEventsLegacy: Example = {
  name: "Forwarded events (non-Runes)",
  moduleName: "ForwardedEventsLegacy",
  code: `<button type="button" on:click on:focus on:blur />
<h1 on:mouseover on:mouseover={() => {}}>
  <slot />
</h1>
`,
};

const aliasedPropsLegacy: Example = {
  name: "Aliased props (non-Runes)",
  moduleName: "AliasedPropsLegacy",
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

const namedSlotsLegacy: Example = {
  name: "Named slots (non-Runes)",
  moduleName: "NamedSlotsLegacy",
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

const restPropsLegacy: Example = {
  name: "Explicit rest props (non-Runes)",
  moduleName: "ExplicitRestPropsLegacy",
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

const componentCommentsLegacy: Example = {
  name: "Component comments (non-Runes)",
  moduleName: "ComponentCommentsLegacy",
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

const functionWithParamsLegacy: Example = {
  name: "Functions with @type and @param (non-Runes)",
  moduleName: "FunctionsWithParamsLegacy",
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
  buttonRunes,
  typeScriptPropsRunes,
  dispatchedEventsRunes,
  dispatchedEventsAnnotatedRunes,
  forwardedEventsRunes,
  genericsRunes,
  aliasedPropsRunes,
  restPropsRunes,
  namedSnippetsRunes,
  componentCommentsRunes,
  functionWithParamsRunes,
  buttonLegacy,
  typeScriptPropsLegacy,
  dispatchedEventsLegacy,
  dispatchedEventsAnnotatedLegacy,
  forwardedEventsLegacy,
  genericsLegacy,
  aliasedPropsLegacy,
  restPropsLegacy,
  namedSlotsLegacy,
  componentCommentsLegacy,
  functionWithParamsLegacy,
];
