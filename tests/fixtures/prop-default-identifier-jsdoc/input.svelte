<script>
  /**
   * Override the default copy behavior of using the navigator.clipboard.writeText API to copy text.
   * @type {(text: string) => void | Promise<void>}
   */
  const defaultCopy = async (text) => {
    await navigator.clipboard.writeText(text);
  };

  export let copy = defaultCopy;

  /**
   * Default size in pixels.
   * @type {number}
   */
  const DEFAULT_SIZE = 16;

  export let size = DEFAULT_SIZE;

  /**
   * Animation configuration applied on mount.
   * @type {{ duration: number; easing: string }}
   */
  const DEFAULT_CONFIG = { duration: 200, easing: "ease-in-out" };

  export let config = DEFAULT_CONFIG;

  /**
   * Items rendered when no value is provided.
   * @type {string[]}
   */
  const DEFAULT_ITEMS = ["one", "two"];

  export let items = DEFAULT_ITEMS;

  /** Fallback label shown when none is provided. */
  const DEFAULT_LABEL = "Submit";

  export let label = DEFAULT_LABEL;
</script>

<button on:click={() => copy(label)}>{label} {size} {config.duration} {items.length}</button>
