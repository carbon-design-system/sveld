<script>
  let { label, onclick, children, value = $bindable("ready"), onpress, ...rest } = $props();
</script>

<button
  {...rest}
  onclick={(event) => {
    onclick?.(event);
    onpress?.(value);
  }}
>
  {label}
  {@render children?.({ value })}
</button>
