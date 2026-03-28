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

  let {
    /** @type {(detail: { isPacked: boolean; speed: number; color?: string; density?: number }) => void} */
    onsnowball,
    /** @type {() => void} */
    onchange,
    /** @type {(detail: { value: string }) => void} */
    onsubmit,
  } = $props();
</script>

<button onclick={() => onsnowball?.({ isPacked: true, speed: 50 })}>Throw</button>
<button onclick={() => onchange?.()}>Change</button>
<button onclick={() => onsubmit?.({ value: "test" })}>Submit</button>
