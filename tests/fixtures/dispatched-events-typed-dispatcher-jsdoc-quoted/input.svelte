<script>
  import { createEventDispatcher } from "svelte";

  /** @type {import('svelte').EventDispatcher<{ "change:value": string; "a;b": number; plain: null }>} */
  const dispatch = createEventDispatcher();
</script>

<div></div>
