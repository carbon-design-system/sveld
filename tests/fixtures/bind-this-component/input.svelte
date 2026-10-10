<script>
  import Modal from "./Modal.svelte";
  import Tooltip from "./Tooltip.svelte";

  export let modalRef = null;
  export let tooltipRef = null;
</script>

<Modal bind:this={modalRef} />
<Tooltip bind:this={tooltipRef} />
