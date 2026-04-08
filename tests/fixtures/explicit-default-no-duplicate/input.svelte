<script>
  const defaultFilter = () => true;

  /**
   * Custom filter function.
   * @default () => true
   * @type {(item: string, value: string) => boolean}
   */
  export let shouldFilter = defaultFilter;

  /**
   * Prop with only an inferred default.
   */
  export let name = "world";

  /**
   * Prop with explicit @default matching the initializer.
   * @default false
   */
  export let disabled = false;

  const DEFAULT_SIZE = "md";

  /**
   * Prop with identifier default, no explicit annotation.
   * Should resolve to the actual value.
   * @type {"sm" | "md" | "lg"}
   */
  export let size = DEFAULT_SIZE;

  const DEFAULT_COUNT = 10;

  /** Number of items to display. */
  export let count = DEFAULT_COUNT;

  const defaultOnClick = () => {};

  /**
   * Click handler.
   * @type {(e: MouseEvent) => void}
   */
  export let onClick = defaultOnClick;

  const DEFAULT_CONFIG = { theme: "dark", density: "compact" };

  /**
   * Component configuration.
   * @type {{ theme: string; density: string }}
   */
  export let config = DEFAULT_CONFIG;

  const DEFAULT_ITEMS = ["a", "b", "c"];

  /** List of items. */
  export let items = DEFAULT_ITEMS;

  const DEFAULT_OFFSET = -1;

  /** Starting offset. */
  export let offset = DEFAULT_OFFSET;
</script>

{name}
{disabled}
{size}
{count}
{offset}
