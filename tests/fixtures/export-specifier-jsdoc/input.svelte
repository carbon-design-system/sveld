<script context="module">
  /**
   * Label doc
   * @type {"a" | "b"}
   */
  const label = "a";

  export { label };
</script>

<script>
  /** Size doc */
  let size = 1;

  /** @type {"x" | "y"} */
  let kind = "x";

  export { kind as variant, size };

  let count = 1;
  let title = "x";

  /** @type {number} Applies to neither specifier */
  export { count, title };

  /**
   * Replaced by the list's own description
   * @type {"open" | "closed"}
   */
  let state = "open";

  /** The panel state */
  export { state };
</script>

<p class={kind}>{size} {count} {title} {state}</p>
