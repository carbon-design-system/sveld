<script>
  /**
   * @event {{ h1: boolean; }} hover
   */

  import { onDestroy, createEventDispatcher } from "svelte";

  const dispatcher = createEventDispatcher();

  onDestroy(() => {
    dispatcher("destroy");
  });
</script>

<button type="button" />
<h1
  on:mouseover={() => {
    dispatcher('hover', { h1: true });
  }}>
  <slot />
</h1>
