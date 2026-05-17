<script>
  function createDefault() {
    return "generated";
  }

  let {
    class: className = "primary",
    value = $bindable(0),
    open = $bindable(),
    items = [1, 2],
    options = { dense: true },
    onaction = () => {},
    computed = createDefault(),
    bare,
  } = $props();
</script>

<button
  class={className}
  onclick={onaction}
  data-open={open}
  data-computed={computed}
  data-bare={bare}
>
  {value}{items.length}{options.dense}
</button>
