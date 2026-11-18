<script lang="ts" module>
  export type Status = "on" | "off";

  type Identified = { id: string };

  export { badge, empty, action };

  /** One row for any item with an id. */
  export { row as itemRow };
</script>

<script lang="ts">
  let { status }: { status: Status } = $props();
</script>

{#snippet badge(status: Status, label?: string)}
  <span>{label ?? status}</span>
{/snippet}

{#snippet empty()}
  <p>Nothing here</p>
{/snippet}

{#snippet row<T extends Identified>(item: T, index = 0)}
  <li>{index}: {item.id}</li>
{/snippet}

{#snippet action<T extends () => void>(handler: T)}
  <button onclick={handler}>Run</button>
{/snippet}

{@render badge(status)}
