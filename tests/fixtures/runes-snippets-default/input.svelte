<script>
  let { item, children } = $props();
</script>

<section>{@render children?.({ item })}</section>
