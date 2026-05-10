<script>
  /**
   * Spread `props` onto a custom element to inherit the link class
   * and `aria-current` attribute when `isCurrentPage` is set.
   * @example
   * ```svelte
   * <BreadcrumbItem let:props>
   *   <a {...props} href="/">Home</a>
   * </BreadcrumbItem>
   * ```
   * @slot {{ props?: { "aria-current"?: string; class: "bx--link" } }}
   */
</script>

<slot props={{ class: "bx--link", "aria-current": undefined }} />
