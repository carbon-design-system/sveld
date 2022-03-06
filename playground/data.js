export const button = {
  moduleName: 'Button',
  code: `<script>
  export let type = "button";
  export let primary = false;
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>`
}

export const dynamic_dispatched_events = {
  moduleName: 'Dispatched events',
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
`
}

export const forwarded_events = {
  moduleName: 'Forwarded events',
  code: `<button type="button" on:click on:focus on:blur />
<h1 on:mouseover on:mouseover={() => {}}>
  <slot />
</h1>
`
}

export default [
  button,
  dynamic_dispatched_events,
  forwarded_events
]