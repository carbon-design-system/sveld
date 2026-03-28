<script>
  let { variant, ...rest } = $props();
</script>

<button {...rest}>{variant}</button>
