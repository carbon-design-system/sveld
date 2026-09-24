<script
  context="module"
  lang="ts"
>
  import type { Base } from "./base.js";

  export interface Item extends Base {
    label: string;
  }

  export type Mode = "compact" | "full";

  type Density = "tight" | "loose";

  export type { Density };

  type Internal = { raw: string };

  export function make(label: string): Item {
    return { id: "", label };
  }
</script>

<script lang="ts">
  export let item: Item;
  export let mode: Mode = "full";
  export let internal: Internal | undefined = undefined;
</script>

<div>{item.label} {mode} {internal?.raw}</div>
