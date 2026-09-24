<script>
  /**
   * @deprecated {@link body} replaces this slot.
   * @slot {{}} header
   */

  /**
   * Options.
   * @default { a: 1, b: 2 }
   */
  export let options = {};

  /**
   * Old prop.
   * @deprecated {@link newProp} replaces this.
   */
  export let oldProp = 1;

  /**
   * Older prop.
   * @deprecated Use newProp,
   *   which is faster.
   */
  export let olderProp = 1;
</script>

<slot name="header" />
