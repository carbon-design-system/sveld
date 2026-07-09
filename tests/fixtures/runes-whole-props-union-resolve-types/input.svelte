<script lang="ts">
  import type { Props } from "./types";

  let props: Props = $props();
</script>

<div data-kind={props.kind}></div>
