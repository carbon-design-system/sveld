<script lang="ts">
  import { setContext } from "svelte";
  import { writable } from "svelte/store";

  type Item = { id: string; label: string };

  let selected: Item | null = null;
  const selectedItem = writable(selected);
  const items = writable<Item[]>([]);

  function select(item: Item, focus?: boolean): void {
    selectedItem.set(item);
  }

  setContext("Picker", {
    selectedItem,
    items,
    select,
    find: (id: string): Item | undefined => undefined,
    clear: () => selectedItem.set(null),
  });
</script>

<slot />
