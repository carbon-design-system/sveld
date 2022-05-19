<script>
  /**
   * @required
   */
  export let prop = true;

  /**
   * This is a comment.
   * @required
   * @type {boolean | string}
   */
  export let prop1 = true;
</script>

<slot {prop} {prop1} />
