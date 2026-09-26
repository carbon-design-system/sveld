<script>
  /** @type {{ label: string; size?: "sm" | "lg" }} */
  let { label, size = "sm" } = $props();
</script>

<span class={size}>{label}</span>
