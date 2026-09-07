<script>
  import { createEventDispatcher } from "svelte";

  let { "data-foo": dataFoo, "123abc": numeric, normal } = $props();

  const dispatch = createEventDispatcher();

  function selectItem() {
    dispatch("item:select");
  }
</script>

<div
  data-foo={dataFoo}
  data-numeric={numeric}
  data-normal={normal}
>
  <slot name="icon-left" />
</div>

<button onclick={selectItem}>select</button>
