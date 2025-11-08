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

  import { createEventDispatcher } from "svelte";

  const dispatcher = createEventDispatcher();

  function throwSnowball() {
    dispatcher("snowball", {
      isPacked: true,
      speed: 50
    });
  }

  function handleChange() {
    dispatcher("change");
  }

  function handleSubmit() {
    dispatcher("submit", { value: "test" });
  }
</script>

<button on:click={throwSnowball}>Throw</button>
<button on:click={handleChange}>Change</button>
<button on:click={handleSubmit}>Submit</button>
