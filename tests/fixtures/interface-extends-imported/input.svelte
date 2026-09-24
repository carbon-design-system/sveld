<script lang="ts">
  import type { Base, Meta } from "./base.js";

  interface Item extends Base, Pick<Meta, "tag"> {
    label: string;
  }

  export let item: Item;
</script>

<div>{item.label}</div>
