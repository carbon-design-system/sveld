<script>
  let { value, onchange } = $props();
</script>

<button onclick={() => onchange?.(value)}>click</button>
