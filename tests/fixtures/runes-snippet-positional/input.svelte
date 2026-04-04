<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    row: Snippet<[item: string, index: number]>;
  }

  let { row }: Props = $props();
  let item = "hello";
  let index = 0;
</script>

{@render row?.(item, index)}
