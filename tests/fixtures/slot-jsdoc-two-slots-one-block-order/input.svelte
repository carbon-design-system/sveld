<script>
  /**
   * First slot only should get `@see`; `pendingTags` clears after each `@slot`.
   * @see https://example.com/docs
   * @slot {{ n: number }} alpha
   * @slot {{ s: string }} beta
   */
</script>

<slot
  name="alpha"
  n={0}
/>
<slot
  name="beta"
  s=""
/>
