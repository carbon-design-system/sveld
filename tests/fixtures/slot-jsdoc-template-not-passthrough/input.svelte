<script>
  /**
   * @template {string} T
   * Body slot uses a generic from `@template`; that tag must not appear on the slot in output.
   * @slot {{ n: number }} body
   */
</script>

<slot
  name="body"
  n={0}
/>
