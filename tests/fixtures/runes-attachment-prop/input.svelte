<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { onmount }: { onmount?: Attachment } = $props();
</script>

<div {@attach onmount}>content</div>
