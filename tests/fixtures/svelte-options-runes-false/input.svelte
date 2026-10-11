<svelte:options runes={false} />

<script>
  import { state } from "./stores.js";

  export let label = "Save";

  // A `$` store read, not a rune: the option keeps legacy mode.
  const initial = $state;
</script>

<button>{label} {initial}</button>
