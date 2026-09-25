<script lang="ts">
  import { setContext } from "svelte";

  interface Item {
    id: string;
  }

  let { children } = $props();

  let count = $state(0);
  let label = $state("menu");
  let open = $state(false);
  let items = $state<Item[]>([]);
  let selected: string | null = $state(null);
  let doubled = $derived(count * 2);
  let offset = 4;

  setContext("menu", { count, label, open, items, selected, doubled, offset });

  let total = $state(0);
  setContext("total", total);
</script>

{@render children?.()}
