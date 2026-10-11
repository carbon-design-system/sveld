<script>
  let { item, children, header } = $props();
</script>

<section>
  {@render header?.({ title: item })}
  {@render children?.({ item })}
</section>
