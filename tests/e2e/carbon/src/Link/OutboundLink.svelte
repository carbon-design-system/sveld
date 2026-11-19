<script>
  /** @extends {"./Link.svelte"} LinkProps */

  import Launch16 from "carbon-icons-svelte/lib/Icon.svelte";
  import Link from "./Link.svelte";
</script>

<Link
  {...$$restProps}
  on:click
  on:mouseover
  on:mouseenter
  on:mouseleave
  target="_blank"
>
  <slot />
  <Launch16 />
</Link>
