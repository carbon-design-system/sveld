<script>
  /**
   * @type {"sm" | "md" | "lg"}
   */
  export let size = "md";

  export let disabled = false;

  import { setContext } from "svelte";
  import { derived, readable, writable } from "svelte/store";
  import { uniqueId } from "./utils.js";

  const query = writable("");
  const sharedSize = writable(size);
  const sharedDisabled = writable(disabled);
  const highlightedId = writable(/** @type {string | null} */ (null));
  const items = writable([]);
  const hasItems = derived(items, (_) => _.length > 0);
  const isEmpty = derived(items, () => false);
  const fallbackName = uniqueId();

  function notifyOpen(id) {}

  /**
   * @param {string} id
   * @returns {boolean}
   */
  function claim(id) {
    return true;
  }

  const reset = () => {};

  /**
   * @returns {{ hasAny: import("svelte/store").Readable<boolean>, register: (id: string) => void }}
   */
  function createRegistry() {
    const ids = writable(new Set());
    return {
      hasAny: derived(ids, (_) => _.size > 0),
      register(id) {
        ids.update((_) => _.add(id));
      },
    };
  }

  const iconColumn = createRegistry();

  setContext("Menu", {
    query,
    size: sharedSize,
    disabled: sharedDisabled,
    highlightedId,
    items,
    hasItems,
    isEmpty,
    max: readable(0),
    fallbackName,
    notifyOpen,
    claim,
    reset,
    registerIcon: iconColumn.register,
    hasIconItems: iconColumn.hasAny,
  });
</script>

<slot />
