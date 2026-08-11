<script>
  /**
   * @returns {string}
   */
  function uniqueId() {
    return "x";
  }

  let id = $derived(uniqueId());
  let count = $state(0);

  let { theId = id, theCount = count } = $props();
</script>

<p>{theId}: {theCount}</p>
