<script>
  let { title, children } = $props();

  function getProps() {
    return { title };
  }
</script>

<div>{title}{@render children(getProps())}</div>
