<script>
  import { setContext } from "svelte";
  import { noop } from "./utils.js";

  /**
   * Number of open panels.
   * Zero when every panel is closed.
   */
  let count = $state(0);

  /**
   * Hidden from docs
   * @internal
   */
  let secret = $state(1);

  let items = $state.raw([1]);

  setContext("panels", {
    count,
    secret,
    items,
    /**
     * Adds an item to the group.
     * @type {(id: string) => void}
     */
    register: noop,
  });

  /** Current label */
  let label = "x";
  setContext("label", label);
</script>
