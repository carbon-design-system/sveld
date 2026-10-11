<script>
  import { uniqueId } from "./utils.js";

  let {
    /**
     * Element id.
     * @default A generated `ccs-` id
     */
    id = uniqueId(),
    /** @default 5 */
    retries = 3,
  } = $props();
</script>

<p {id}>{retries}</p>
