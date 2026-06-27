<script>
  import { createEventDispatcher } from "svelte";

  /**
   * Fired when the value changes.
   * @event {string} change
   * @since 1.1.0
   * @example
   * ```svelte
   * <Field on:change={(e) => console.log(e.detail)} />
   * ```
   */
  const dispatch = createEventDispatcher();

  export let value = "";

  function update(event) {
    value = event.target.value;
    dispatch("change", value);
  }
</script>

<input
  {value}
  on:input={update}
>
