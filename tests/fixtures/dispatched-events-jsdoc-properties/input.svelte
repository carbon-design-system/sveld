<script>
  /**
   * Snowball event fired when throwing a snowball.
   *
   * @event snowball
   * @type {object}
   * @property {boolean} isPacked - Indicates whether the snowball is tightly packed.
   * @property {number} speed - The speed of the snowball in mph.
   * @property {string} [color] - Optional color of the snowball.
   * @property {number} [density=0.9] - Optional density with default value.
   */

  /**
   * Will be fired if value has been changed
   * @event change
   */

  /**
   * @event {{ value: string }} submit - Form submission with value
   */

  /**
   * The event detail described once as a named typedef, then reused via `@event`.
   * @typedef {object} ChangeDetail
   * @property {string[]} items - The full new set of items.
   * @property {string[]} added - Items added since the last change.
   * @property {string[]} [removed] - Items removed since the last change.
   */

  /**
   * Fired when the collection changes. The detail carries the up-to-date,
   * well-formed set of items (hyphenated prose must survive verbatim).
   * @event {ChangeDetail} items:change
   */

  import { createEventDispatcher } from "svelte";

  const dispatcher = createEventDispatcher();

  function throwSnowball() {
    dispatcher("snowball", {
      isPacked: true,
      speed: 50,
    });
  }

  function handleChange() {
    dispatcher("change");
  }

  function handleSubmit() {
    dispatcher("submit", { value: "test" });
  }

  function handleItemsChange() {
    dispatcher("items:change", { items: [], added: [], removed: [] });
  }
</script>

<button on:click={throwSnowball}>Throw</button>
<button on:click={handleChange}>Change</button>
<button on:click={handleSubmit}>Submit</button>
<button on:click={handleItemsChange}>Change items</button>
