<script>
  /**
   * Override the default copy behavior of using the navigator.clipboard.writeText API to copy text.
   * @type {(text: string) => void | Promise<void>}
   */
  const defaultCopy = async (text) => {
    await navigator.clipboard.writeText(text);
  };

  /**
   * Default size in pixels.
   * @type {number}
   */
  const DEFAULT_SIZE = 16;

  /**
   * Animation configuration applied on mount.
   * @type {{ duration: number; easing: string }}
   */
  const DEFAULT_CONFIG = { duration: 200, easing: "ease-in-out" };

  /** Fallback label shown when none is provided. */
  const DEFAULT_LABEL = "Submit";

  let { copy = defaultCopy, size = DEFAULT_SIZE, config = DEFAULT_CONFIG, label = DEFAULT_LABEL } = $props();
</script>

<button onclick={() => copy(label)}>{label} {size} {config.duration}</button>
