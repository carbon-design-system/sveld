<script>
  let { count: initialCount = 0 } = $props();
  let count = $state(initialCount);
</script>

<button onclick={() => count++}>{count}</button>
