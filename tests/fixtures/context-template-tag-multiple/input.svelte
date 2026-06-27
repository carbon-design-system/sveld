<script>
  /**
   * @template {string} [Value=string]
   * @template [Icon=any]
   */

  /** @type {Value | undefined} */
  export let selected = undefined;

  /** @type {Icon} */
  export let icon = undefined;

  import { setContext } from "svelte";
  import { writable } from "svelte/store";

  /** @type {import("svelte/store").Writable<Value | undefined>} */
  const selectedValue = writable(selected);

  setContext("demo:Wrapper", { selectedValue, icon });
</script>

<slot />
