<script lang="ts">
  interface Item {
    id: string;
  }

  type Status = "idle" | "busy";

  export let items: Array<Item> = [];
  export let statuses: Map<string, Status> = new Map();
</script>

<div>{items.length} {statuses.size}</div>
