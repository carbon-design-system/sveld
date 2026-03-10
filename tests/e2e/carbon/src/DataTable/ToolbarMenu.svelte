<script>
  /** @extends {"../OverflowMenu/OverflowMenu.svelte"} OverflowMenuProps */

  import Settings16 from "carbon-icons-svelte/lib/Settings16";
  import { getContext } from "svelte";
  import { OverflowMenu } from "../OverflowMenu";

  const ctx = getContext("Toolbar");

  let menuRef = null;

  $: ctx.setOverflowVisible(menuRef != null);
  $: if (menuRef) menuRef.style.top = "100%";
</script>

<OverflowMenu
  bind:menuRef
  icon={Settings16}
  {...$$restProps}
  class="bx--toolbar-action bx--overflow-menu {$$restProps.class}"
  flipped
>
  <slot />
</OverflowMenu>
