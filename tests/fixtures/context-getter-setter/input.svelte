<script lang="ts">
  import { setContext } from "svelte";

  /**
   * Current count
   * @type {number}
   */
  let count = $state(0);
  let label = $state("items");

  setContext("counter", {
    get count() {
      return count;
    },
    set count(value) {
      count = value;
    },
    get label(): string {
      return label.toUpperCase();
    },
    set step(value: number) {
      count += value;
    },
  });
</script>

<p>{count} {label}</p>
