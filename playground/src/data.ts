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

const dynamic_dispatched_events = {
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

export default [button, dynamic_dispatched_events, forwarded_events, generics];
