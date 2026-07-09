<script
  lang="ts"
  generics="Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow"
>
  interface DataTableRow {
    id: string | number;
    [key: string]: any;
  }

  let {
    onSelect,
    rows,
  }: {
    onSelect: Handler;
    rows: ReadonlyArray<Row>;
  } = $props();
</script>

<slot
  {onSelect}
  {rows}
/>
