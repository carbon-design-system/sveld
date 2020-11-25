<script>
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
    dispatcher('hover', { h1: true });
  }}>
  <slot />
</h1>
