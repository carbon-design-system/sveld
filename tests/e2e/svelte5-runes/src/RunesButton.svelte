<script>
  import { createEventDispatcher } from "svelte";

  let { label, onclick, children, value = $bindable("ready"), ...rest } = $props();

  const dispatch = createEventDispatcher();
</script>

<button
  {...rest}
  onclick={(event) => {
    onclick?.(event);
    dispatch("press", value);
  }}
>
  {label}
  {@render children?.({ value })}
</button>
