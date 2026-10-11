<script>
  /**
   * A size token.
   * @typedef {"sm" | "lg"} Size
   */

  /**
   * @typedef {object} Props
   * @property {string} title Card title
   * @property {boolean} [elevated=false] Elevated look
   * @property {(e: MouseEvent) => void} [onclick] Click handler
   * @property {Size} [size]
   */

  /** @type {Props} */
  let { title, elevated = false, onclick, size = "sm" } = $props();
</script>

<button
  class:elevated
  class={size}
  {onclick}
>
  {title}
</button>
