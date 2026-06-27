<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /**
   * The visible label.
   * @deprecated Use the `text` prop instead.
   */
  export let label = "";

  /**
   * @deprecated
   */
  export let id = "";

  /**
   * Programmatically focus the field.
   * @deprecated Focus the underlying element directly.
   */
  export function focus() {}

  /**
   * Fired when the value changes.
   * @event {{ value: string }} change
   * @deprecated Listen for the native `input` event instead.
   */

  /**
   * Badge content rendered next to the label.
   * @deprecated Render the badge inline instead.
   * @slot {{ count: number }} badge
   */
  function dispatchChange() {
    dispatch("change", { value: label });
  }
</script>

<button on:click={dispatchChange}>
  {label}
  <slot
    name="badge"
    count={0}
  />
</button>
