<script lang="ts">
  interface Props {
    /** Badge label */
    label: string;
    /**
     * Visual tone
     * @deprecated Use `variant` instead.
     */
    tone?: "info" | "warn";
    count?: number;
  }

  let { label, tone = "info", count }: Props = $props();
</script>

<span class={tone}>{label} {count}</span>
