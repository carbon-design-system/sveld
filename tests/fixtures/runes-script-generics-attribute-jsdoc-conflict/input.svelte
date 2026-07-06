<script
  lang="ts"
  generics="Row extends DataTableRow = DataTableRow"
>
  /**
   * @generics {Header extends string = string} Header
   */
  interface DataTableRow {
    id: string | number;
    [key: string]: any;
  }

  let {
    headers,
    rows,
  }: {
    headers: ReadonlyArray<Row>;
    rows: ReadonlyArray<Row>;
  } = $props();
</script>

<slot
  {headers}
  {rows}
/>
