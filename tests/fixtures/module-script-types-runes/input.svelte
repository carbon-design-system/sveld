<script
  module
  lang="ts"
>
  export interface Item {
    id: string;
  }

  export function make(): Item {
    return { id: "" };
  }
</script>

<script lang="ts">
  let { item }: { item: Item } = $props();
</script>

<div>{item.id}</div>
