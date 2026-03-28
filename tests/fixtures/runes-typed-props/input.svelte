<script>
  /**
   * This is a comment.
   * @see https://github.com/
   * @deprecated this prop will be removed in the next major release.
   * @type {boolean | string}
   */
  let {
    prop = true,
    /** @see https://github.com/ */
    prop1 = true,
    /**
     * This is a comment.
     * @type {boolean | string}
     */
    prop2 = true,
  } = $props();
</script>

{prop}
{prop1}
{prop2}
