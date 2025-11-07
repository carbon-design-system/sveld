<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Component dispatches a 'change' event with custom payload
  function handleChange() {
    dispatch('change', { value: 'custom' });
  }
</script>

<!-- Forwarding the native 'change' event from input -->
<input on:change />

<button on:click={handleChange}>Trigger Custom Change</button>
