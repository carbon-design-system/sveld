<script>
  import Modal from "./Modal.svelte";

  let { svgRef = $bindable(null), pathRef = $bindable(null), modalRef = $bindable(null) } = $props();
</script>

<svg bind:this={svgRef}>
  <path bind:this={pathRef} />
</svg>
<Modal bind:this={modalRef} />
