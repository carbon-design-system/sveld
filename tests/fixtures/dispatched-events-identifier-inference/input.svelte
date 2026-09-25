<script lang="ts">
  import { createEventDispatcher } from "svelte";

  type Item = { id: string };

  const dispatch = createEventDispatcher();

  let count = 0;
  let label = "none";
  let open = false;
  let total = $state(0);
  let items = $state<Item[]>([]);
  let doubled = $derived(total * 2);
  let selected: Item | undefined;
  let roll = Math.random();

  function change() {
    dispatch("change", { count, label, open });
  }

  function update() {
    dispatch("update", { total, items, doubled });
  }

  function select() {
    dispatch("select", { selected });
  }

  function reroll() {
    dispatch("reroll", { roll });
    dispatch("roll", roll);
  }

  function scalars() {
    dispatch("count", count);
    dispatch("items", items);
  }

  function rename(label) {
    dispatch("rename", { label });
  }
</script>

<button onclick={change}>Change</button>
<button onclick={update}>Update</button>
<button onclick={select}>Select</button>
<button onclick={reroll}>Reroll</button>
<button onclick={scalars}>Scalars</button>
<button onclick={() => rename("next")}>Rename</button>
