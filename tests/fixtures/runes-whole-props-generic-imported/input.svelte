<script
  lang="ts"
  generics="T extends Identifiable"
>
  import type { Props } from "./types";

  interface Identifiable {
    id: string;
  }

  let props: Props<T> = $props();
</script>

<p>{props.item.id}</p>
