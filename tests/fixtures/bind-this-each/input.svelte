<script>
  import Modal from "./Modal.svelte";

  export let items = ["a", "b"];
  export let itemRefs = [];
  export let keyedRefs = [];
  export let circleRefs = [];
  export let modalRefs = [];
</script>

<ul>
  {#each items as item, i}
    <li bind:this={itemRefs[i]}>{item}</li>
    <span bind:this={keyedRefs[item.length]}>{item}</span>
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
