<script>
  import { generateId } from "./id.js";

  let { id = generateId() } = $props();
</script>

<div>{id}</div>
