<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  /**
   * @generics {Element extends HTMLElement = HTMLDivElement} Element
   */

  let { measure }: { measure?: Attachment<Element> } = $props();
</script>

<div {@attach measure}>content</div>
