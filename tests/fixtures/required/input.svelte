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

  export let prop2;

  /** @type {boolean} */
  export let prop3;
</script>

<slot {prop} {prop1} {prop2} {prop3} />
