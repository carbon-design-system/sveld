<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { createTooltip }: { createTooltip?: (text: string) => Attachment } = $props();
</script>

<div {@attach createTooltip?.("hello")}>content</div>
