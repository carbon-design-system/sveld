<script>
  import { helper, validator } from "./utils";

  // Re-export utilities (uncommon pattern but should not crash)
  export { helper, validator };

  /** Array of data items */
  export let data = [];

  /** Whether to show details */
  export let showDetails = false;
</script>

<div class="wrapper">
  {#each data as item}
    <div class="item">{item}</div>
  {/each}
</div>
