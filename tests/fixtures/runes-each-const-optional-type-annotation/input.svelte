<script lang="ts">
  let {
    rows,
    ...rest
  }: {
    rows: { id: string; label?: string }[];
  } = $props();
</script>

<ul>
  {#each rows as row: { id: string; label?: string }, i (row.id)}
    {@const text: { value?: string } = { value: row.label }}
    <li>{i}: {text.value ?? row.id}</li>
  {/each}
</ul>

<p {...rest}>{rows.length} rows</p>
