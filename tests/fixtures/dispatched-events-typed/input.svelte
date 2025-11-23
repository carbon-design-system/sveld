<script>
  /**
   * @event {{ h1: boolean; }} hover - Fired on mouseover.
   */

  import { createEventDispatcher, onDestroy } from "svelte";

  const dispatcher = createEventDispatcher();

  onDestroy(() => {
    dispatcher("destroy");
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
