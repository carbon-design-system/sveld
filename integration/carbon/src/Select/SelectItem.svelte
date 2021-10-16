<script>
  /** Specify the option value */
  export let value = "";

  /** Specify the option text */
  export let text = "";

  /** Set to `true` to hide the option */
  export let hidden = false;

  /** Set to `true` to disable the option */
  export let disabled = false;

  import { getContext, onDestroy } from "svelte";

  const ctx = getContext("Select") || getContext("TimePickerSelect");

  let selected = false;

  const unsubscribe = ctx.selectedValue.subscribe((currentValue) => {
    selected = currentValue === value;
  });

  onDestroy(() => {
    unsubscribe();
  });
</script>

<option
  {value}
  {disabled}
  {hidden}
  {selected}
  class:bx--select-option={true}
  class={$$restProps.class}
  style={$$restProps.style}
>
  {text || value}
</option>
