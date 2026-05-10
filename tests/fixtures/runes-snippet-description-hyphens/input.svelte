<script>
  /**
   * First line documents `row-id` binding.
   * Second line: column-id and drag-and-drop targets share one surface.
   * @snippet {{ row: string; col: string }}
   */
  let { row, col, children } = $props();
</script>

<div>{@render children?.({ row, col })}</div>
