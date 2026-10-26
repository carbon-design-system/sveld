<script context="module">
  /** @typedef {{ id: string }} Row */
</script>

<script generics="R extends Row = Row">
  /** @type {ReadonlyArray<R>} */
  export let rows = [];
</script>

<slot {rows} />
