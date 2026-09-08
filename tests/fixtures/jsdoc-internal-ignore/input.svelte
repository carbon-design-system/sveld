<script context="module">
  /**
   * Internal-only module export.
   * @internal
   */
  export const INTERNAL_CONST = 1;

  /** Public module export. */
  export const PUBLIC_CONST = 2;
</script>

<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /**
   * The visible label.
   */
  export let label = "";

  /**
   * Internal-only prop, not part of the public API.
   * @internal
   */
  export let debugId = "";

  /**
   * Ignored prop.
   * @ignore
   */
  export let legacyFlag = false;

  /**
   * @internal
   * @typedef {{ count: number }} InternalCount
   */

  /**
   * @typedef {{ label: string }} PublicLabel
   */

  /**
   * Fired when the value changes.
   * @event {{ value: string }} change
   */

  /**
   * Fired for internal diagnostics only.
   * @event {{ reason: string }} debug
   * @internal
   */

  /**
   * Badge content rendered next to the label.
   * @slot {{ count: number }} badge
   */

  /**
   * Internal-only slot.
   * @internal
   * @slot {{}} debug-panel
   */
  function dispatchChange() {
    dispatch("change", { value: label });
    dispatch("debug", { reason: "test" });
  }
</script>

<button on:click={dispatchChange}>
  {label}
  <slot
    name="badge"
    count={0}
  />
  <slot name="debug-panel" />
</button>
