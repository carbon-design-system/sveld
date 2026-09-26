<script>
  /**
   * @typedef {object} Props
   * @property {string} title Card title
   * @property {boolean} [elevated=false] Elevated look
   * @property {(e: MouseEvent) => void} [onclick] Click handler
   */

  /** @type {Props} */
  let { title, elevated = false, onclick } = $props();
</script>

<button
  class:elevated
  {onclick}
>
  {title}
</button>
