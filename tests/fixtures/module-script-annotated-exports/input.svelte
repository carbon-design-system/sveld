<script
  context="module"
  lang="ts"
>
  import type { Item } from "./types.js";

  type Size = "sm" | "lg";

  export const sizes: Size[] = ["sm", "lg"];
  export const registry: Map<string, Item> = new Map();
  export let current: Item | undefined;

  const fallback: Size = "sm" as any;

  export { fallback };
</script>

<script lang="ts">
  let label: string | number = "" as any;

  export { label };
</script>
