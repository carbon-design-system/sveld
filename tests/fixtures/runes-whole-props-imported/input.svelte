<script lang="ts">
  import type { Props } from "./types";

  let props: Props = $props();
</script>

<a
  href={props.href}
  aria-disabled={props.disabled}
  >{props.variant}</a
>
