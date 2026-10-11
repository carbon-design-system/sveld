<svelte:options runes={false} />

<script>
  // biome-ignore lint/correctness/noUnusedImports: read below as the `$state` store
  import { state } from "./stores.js";

  export let label = "Save";

  // A `$` store read, not a rune: the option keeps legacy mode.
  const initial = $state;
</script>

<button>{label} {initial}</button>
