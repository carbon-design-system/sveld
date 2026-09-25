<script>
  let defaultSize = "md";
  let compact = false;
  let theme;

  /** Nullish fallback */
  export let size = defaultSize ?? "md";

  /** Falsy fallback */
  export let items = theme || [];

  /** Logical and */
  export let showIcon = compact && true;

  /** Ternary */
  export let label = compact ? "…" : "More";

  /** A long ternary spread over several lines */
  export let tone =
    theme === "dark"
      ? "light-text-on-dark-background"
      : theme === "light"
        ? "dark-text-on-light-background"
        : "neutral";

  // biome-ignore lint/complexity/noCommaOperator: fixture covers a sequence expression default
  export let last = (compact, 42);

  /** A description that already documents its default
   * @default "md"
   */
  export let explicit = defaultSize ?? "md";
</script>

<div>{size} {items} {showIcon} {label} {tone} {last} {explicit}</div>
