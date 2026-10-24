<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let {
    onmount,
    createTooltip,
    attachments = [],
  }: {
    onmount?: Attachment;
    createTooltip?: (text: string) => Attachment;
    attachments?: Attachment[];
  } = $props();
</script>

<div {@attach onmount}>content</div>
<div {@attach createTooltip?.("hello")}>content</div>
<div
  {@attach (node) => {
    for (const attach of attachments) attach(node);
  }}
>
  content
</div>
