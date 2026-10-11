<script>
  /**
   * @returns {string}
   */
  function uniqueId() {
    return "x";
  }

  let now = new Date();
  let defaultLabel = $derived(now.toISOString());
  let id = $derived(uniqueId());
  let count = $state(0);

  let { label = defaultLabel, theId = id, theCount = count } = $props();
</script>

<p>{label} {theId}: {theCount}</p>
