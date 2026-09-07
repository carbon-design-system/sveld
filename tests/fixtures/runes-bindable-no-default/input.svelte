<script>
  let { value = $bindable(0), open = $bindable(), onclick } = $props();
</script>

<button {onclick}>{value} {open}</button>
