<script>
  import { createEventDispatcher, setContext } from "svelte";

  /** Pattern to match */
  export let pattern = /^[a-z]+$/i;

  /** Large counter */
  export let total = 10n;

  const dispatch = createEventDispatcher();

  setContext("matcher", { pattern: /x/, limit: 5n });

  $: dispatch("match", { pattern: /y/g, count: 1n });
</script>

<div>{pattern} {total}</div>
