<script lang="ts">
  import Generics from "./output";
</script>

<Generics
  headers={[
    {
      key: "name",
      value: "Name",
    },
    {
      key: "port",
      value: "Port",
    },
  ]}
  rows={[
    { id: 1, name: "Name 1", port: 3000 },
    { id: 2, name: "Name 2", port: 3000 },
    { id: 3, name: "Name 3", port: 3000 },
  ]}
  let:rows
>
  {#each rows as row}
    {row.name}
  {/each}
</Generics>
