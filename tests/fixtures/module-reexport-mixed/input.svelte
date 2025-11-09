<script context="module">
  import { External } from 'lib';

  /**
   * A local utility function for formatting
   * @type {(value: any) => string}
   */
  export const formatValue = (value) => String(value);

  // Re-export external component
  export { External };

  /** Application version number */
  export const VERSION = '1.0.0';

  /**
   * Logger function
   * @type {(msg: string) => void}
   */
  export function log(msg) {
    console.log(msg);
  }
</script>

<script>
  /** Item name to display */
  export let name;

  /** Optional item value */
  export let value = null;
</script>

<span class="item">
  {name}: {value}
</span>
