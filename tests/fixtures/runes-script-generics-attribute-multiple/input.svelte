<script
  lang="ts"
  generics="Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never"
>
  interface DataTableRow {
    id: string | number;
    [key: string]: any;
  }

  let {
    headers,
    rows,
    key,
  }: {
    headers: ReadonlyArray<Row>;
    rows: ReadonlyArray<Row>;
    key?: K;
  } = $props();
</script>

<slot
  {headers}
  {rows}
/>
