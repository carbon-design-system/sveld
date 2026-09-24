<script>
  /**
   * @typedef {object} Header
   * @property {"ascending"
   *   | "descending"
   *   | "none"} [dir] - The intended next sort direction,
   *   reported regardless.
   * @property {"ascending"
   *   | "descending"} [prev]
   *   Description on the line after the type.
   * @typedef {import("svelte").ComponentProps<
   *   import("svelte").SvelteComponent>} Aliased - Props of any component,
   *   spread onto the root.
   * @typedef {"sm"
   *   | "lg"} Size
   */

  /**
   * @callback Formatter
   * @param {string
   *   | number} value - The raw value,
   *   before formatting.
   * @returns {string
   *   | undefined} - The formatted text.
   */

  /**
   * @event {{ id: string;
   *   index: number }} select - Fired when a row is selected,
   *   with its position.
   * @event {null} close
   */

  /**
   * @slot {{ item: string;
   *   index: number }} item - Renders one item,
   *   with its props.
   * @slot {{}} footer
   */

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /** @type {Header} */
  export let header = {};

  /** @type {Aliased} */
  export let aliased = {};

  /** @type {Size} */
  export let size = "sm";

  /** @type {Formatter} */
  export let formatter = (value) => String(value);

  /**
   * Formats a value.
   * @param {string
   *   | number} value - The raw value,
   *   before normalization.
   * @returns {string
   *   | undefined} - The normalized text.
   */
  export function format(value) {
    dispatch("select", { id: String(value), index: 0 });
    dispatch("close", null);
    return formatter(value);
  }
</script>

<slot
  name="item"
  item={format(header.dir ?? size)}
  index={0}
/>
<slot
  name="footer"
  {aliased}
/>
