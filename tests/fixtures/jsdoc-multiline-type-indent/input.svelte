<script>
  /**
   * Attributes of the underlying anchor.
   * @type {import("svelte/elements")
   *   .SvelteHTMLElements["a"]}
   */
  export let attributes = {};

  /**
   * @type {"sm"
   *   | "md"
   *   | "lg"}
   */
  export let size = "md";
</script>

<a
  href="/"
  {...attributes}
  class:small={size === "sm"}
  ><slot /></a
>
