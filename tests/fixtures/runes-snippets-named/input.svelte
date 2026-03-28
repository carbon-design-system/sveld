<script>
  let { item, header } = $props();
</script>

<section>{@render header?.({ title: item })}</section>
