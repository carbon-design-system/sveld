<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";

  let { variant = "primary", ...rest }: { variant?: "primary" | "secondary" } & HTMLButtonAttributes = $props();
</script>

<button
  class={variant}
  {...rest}
></button>
