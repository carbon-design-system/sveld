<script lang="ts">
  import Generics from "./output";

  const rows = [
    { id: 1, name: "Name 1", port: 3000 },
    { id: 2, name: "Name 2", port: 3001 },
    { id: 3, name: "Name 3", port: 3000 },
  ] as const;
</script>

<Generics
  headers={[
    {
      key: "name",
      value: {
        id: 0,
        name: "Name",
        port: 3000,
      },
    },
    {
      key: "port",
      value: {
        id: 1,
        name: "Name",
        port: 3001,
      },
    },
  ]}
  {rows}
  let:headers
  let:rows
>
  {#each rows as row}
    {row.name}
  {/each}
  {#each headers as header}
    {header.value.name}
  {/each}
</Generics>
