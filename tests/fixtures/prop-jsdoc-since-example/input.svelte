<script>
  /**
   * The accessible label for the button.
   * @since 1.4.0
   * @example
   * ```svelte
   * <Button label="Save" />
   * ```
   */
  export let label = "Click";

  /**
   * Visual size token.
   * @since 0.9.0
   */
  export let size = "md";
</script>

<button aria-label={label}>{size}</button>
