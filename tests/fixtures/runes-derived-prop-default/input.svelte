<script>
  let now = new Date();
  let defaultLabel = $derived(now.toISOString());

  let { label = defaultLabel } = $props();
</script>

<p>{label}</p>
