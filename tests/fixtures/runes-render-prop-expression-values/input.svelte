<script>
  let { title = "", count = 0, children } = $props();
</script>

{@render children?.({ heading: title, count, kind: "primary", size: 2 })}
