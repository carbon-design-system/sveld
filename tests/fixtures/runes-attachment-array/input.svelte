<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { attachments = [] }: { attachments?: Attachment[] } = $props();
</script>

<div {@attach (node) => { for (const attach of attachments) attach(node); }}>content</div>
