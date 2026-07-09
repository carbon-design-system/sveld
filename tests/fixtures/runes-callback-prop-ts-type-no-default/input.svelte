<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { measure }: { measure?: (node: HTMLElement) => Attachment } = $props();
</script>

<div {@attach measure}></div>
