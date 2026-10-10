<script>
  /** @type {{ size?: "sm" | "md" }} */
  let { size = "md", ...rest } = $props();

  const props = $derived({ ...rest, class: ["btn", `btn-${size}`, rest.class].filter(Boolean).join(" ") });
</script>

<button {...props}>Go</button>
