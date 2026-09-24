<script>
  /**
   * @typedef {object} Config
   * @property {number} itemHeight Height of each item in pixels, used for
   *   virtualization math.
   * @property {number} [overscan] Rows rendered outside the viewport,
   * above and below it.
   * @property {boolean} [sticky]
   */

  /**
   * @event {object} change
   * Fired when the page changes.
   * @type {object}
   * @property {number} page The new page, counted
   *   from one.
   * @property {number} pageSize
   */

  /**
   * @event {object} select
   * @property {string} id The selected id,
   *   never empty.
   * @property {number} index
   * Fired when a row is selected.
   */

  /**
   * @slot {{ item: string }} item Renders one item,
   *   with its props.
   * @slot {{}} footer
   */

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /** @type {Config} */
  export let config = { itemHeight: 1 };

  /**
   * Formats a value.
   * @param {string} value The raw value, before
   *   normalization.
   * @returns {string}
   */
  export function format(value) {
    dispatch("change", { page: 1, pageSize: 10 });
    dispatch("select", { id: value, index: 0 });
    return value;
  }
</script>

<slot
  name="item"
  item={format(String(config.itemHeight))}
/>
<slot name="footer" />
