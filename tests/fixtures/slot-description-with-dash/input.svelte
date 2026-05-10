<script>
  /**
   * Spread `props` onto a custom element to inherit the link class
   * and `aria-current` attribute when `isCurrentPage` is set.
   * @slot {{props?: { "aria-current"?: string; class: "bx--link"; }}}
   */
</script>

<slot
  props={{
    "aria-current": $$restProps["aria-current"],
    class: "bx--link",
  }}
/>
