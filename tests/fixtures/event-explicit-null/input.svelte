<script>
  import { createEventDispatcher } from 'svelte';

  /**
   * @restProps {input}
   * @event {null} clear
   */

  const dispatch = createEventDispatcher();

  function handleClear() {
    dispatch('clear');
  }
</script>

<input on:change on:input />
<button on:click={handleClear}>Clear</button>
