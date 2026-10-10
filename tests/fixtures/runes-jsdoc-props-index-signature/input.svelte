<script>
  /** @type {{ size?: "sm" | "md"; label: string; [key: string]: any }} */
  let { size = "sm", label, ...rest } = $props();
</script>

<button {...rest}>{label} {size}</button>
