<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Size = "sm" | "md";

  export let attributes = { type: "button" } as HTMLButtonAttributes;
  export let size = "sm" as Size;
  export let sizes = [] as unknown as Size[];
  export let checked = { type: "button" } satisfies HTMLButtonAttributes;
</script>
