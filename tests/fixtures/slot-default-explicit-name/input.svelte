<script>
  /**
   * @slot {{ count: number }} default - Page content rendered after the header.
   */
  export let count = 0;
</script>

<slot {count} />
