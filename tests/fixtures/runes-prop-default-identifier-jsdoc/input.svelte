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

  /**
   * Determine if an item should be filtered given the current value.
   * @type {(item: string, value: string) => boolean}
   */
  function defaultShouldFilter() {
    return true;
  }

  function defaultFormat(value) {
    return String(value);
  }

  /** Render the message shown when there are no items. */
  function defaultRenderEmpty() {
    return "No results";
  }

  /**
   * Resolve the unique key for an item.
   * @param {string} item
   * @param {number} index
   * @returns {string}
   */
  function defaultGetKey() {
    return "";
  }

  /**
   * Translate a label to the active locale.
   * @type {(key: string) => string}
   * @example translate("submit") // => "Submit"
   */
  function defaultTranslate(key) {
    return key;
  }

  let {
    copy = defaultCopy,
    size = DEFAULT_SIZE,
    config = DEFAULT_CONFIG,
    label = DEFAULT_LABEL,
    shouldFilterItem = defaultShouldFilter,
    format = defaultFormat,
    renderEmpty = defaultRenderEmpty,
    getKey = defaultGetKey,
    translate = defaultTranslate,
  } = $props();
</script>

<button onclick={() => copy(label)}>
  {label} {size} {config.duration} {shouldFilterItem("a", "b")}
  {format(1)} {renderEmpty()} {getKey("a", 0)} {translate("submit")}
</button>
