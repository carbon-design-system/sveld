<script>
  import Modal from "./Modal.svelte";
  import Tooltip from "./Tooltip.svelte";
  import * as UI from "./ui.js";
  import { Popover } from "./ui.js";

  export let modalRef = null;
  export let tooltipRef = null;
  export let popoverRef = null;
  export let elementOrModal = null;
  // Not nameable as a type: left untyped.
  export let namespacedRef = null;
  export let selfRef = null;
</script>

<Modal bind:this={modalRef} />
<Tooltip bind:this={tooltipRef} />
<Popover bind:this={popoverRef} />
{#if modalRef}
  <div bind:this={elementOrModal} />
{:else}
  <Modal bind:this={elementOrModal} />
{/if}
<UI.Modal bind:this={namespacedRef} />
<svelte:self bind:this={selfRef} />
