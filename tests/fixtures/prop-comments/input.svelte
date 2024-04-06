<script>
  /**
   * This is a comment.
   * @see https://github.com/
   * @deprecated this prop will be removed in the next major release.
   * @type {boolean | string}
   */
  export let prop = true;

  /** @see https://github.com/ */
  export let prop1 = true;

  /**
   * This is a comment.
   * @type {boolean | string}
   */
  export let prop2 = true;
</script>

<slot {prop} {prop1} {prop2} />
