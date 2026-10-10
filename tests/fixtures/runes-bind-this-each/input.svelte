<script>
  import Modal from "./Modal.svelte";

  let {
    items = ["a", "b"],
    itemRefs = $bindable([]),
    circleRefs = $bindable([]),
    modalRefs = $bindable([]),
  } = $props();
</script>

<ul>
  {#each items as item, i}
    <li bind:this={itemRefs[i]}>{item}</li>
  {/each}
</ul>

<svg>
  {#each items as item, i}
    <circle bind:this={circleRefs[i]} />
  {/each}
</svg>

{#each items as item, i}
  <Modal bind:this={modalRefs[i]} />
{/each}
