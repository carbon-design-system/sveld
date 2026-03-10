<script>
  /** @extends {"../Copy/Copy.svelte"} CopyProps */

  /** Set the title and ARIA label for the copy button */
  export let iconDescription = "Copy to clipboard";

  import Copy16 from "carbon-icons-svelte/lib/Copy16";
  import { Copy } from "../Copy";
</script>

<Copy
  class="bx--copy-btn"
  aria-label={iconDescription}
  title={iconDescription}
  {...$$restProps}
  on:click
  on:animationend
>
  <Copy16 class="bx--snippet__icon" />
</Copy>
