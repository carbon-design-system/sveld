<script>
  let defaultSize = "md";
  let compact = false;
  let theme = "screen";

  let {
    /** Nullish fallback */
    size = defaultSize ?? "md",
    /** Ternary */
    label = compact ? "…" : "More",
    /** A long ternary spread over several lines */
    tone = compact
      ? "compact-spacing-with-tight-line-height"
      : theme === "print"
        ? "print-friendly-spacing"
        : "comfortable-spacing",
    /** Bindable fallback */
    value = $bindable(defaultSize || "sm"),
  } = $props();
</script>

<div>{size} {label} {tone} {value}</div>
