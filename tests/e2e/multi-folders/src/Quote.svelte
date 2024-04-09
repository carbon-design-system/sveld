<script>
  /** @type {*} */
  export let quote = "";

  /**
   * @typedef {string} Author
   */

  /** @type {Author} */
  export let author = "";
</script>

<blockquote {...$$restProps}>
  <slot>{quote}</slot>
  <footer>– {author}</footer>
</blockquote>
