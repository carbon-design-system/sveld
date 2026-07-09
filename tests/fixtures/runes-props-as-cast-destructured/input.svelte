<script lang="ts">
  let { value, label } = $props() as { value: number; label?: string };
</script>

<p>{value} {label}</p>
