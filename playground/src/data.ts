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
  	* @typedef {{ value: string }} FormValues
  	* @event {FormValues} change
    * @event {Formvalues} submit
   	*/
  import { createEventDispatcher } from "svelte";
  
  const dispatch = createEventDispatcher();
  
  /** @type {string} */
  export let value = "";
  
  function handleSubmit(event) {
    event.preventDefault();
    dispatch("submit", { value });
  }
</script>

<form on:submit={handleSubmit}>
  <input 
    type="text"
    bind:value
    on:input={() => dispatch("change", { value })}
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
];
