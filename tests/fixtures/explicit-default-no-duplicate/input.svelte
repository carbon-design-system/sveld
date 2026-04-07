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
</script>

{name}
{disabled}
