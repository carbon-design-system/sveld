<script lang="ts">
  interface Props {
    /** Badge label */
    label: string;
    /**
     * Visual tone
     * @deprecated Use `variant` instead.
     */
    tone?: "info" | "warn";
  }

  let { label, tone = "info" }: Props = $props();
</script>

<span class={tone}>{label}</span>
