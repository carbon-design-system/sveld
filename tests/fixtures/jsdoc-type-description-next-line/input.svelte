<script>
  import { createEventDispatcher } from "svelte";

  /**
   * @event change
   * @type {{ value: string }}
   * Fired on change.
   */

  /**
   * @slot {{ item: string }}
   *   Renders each item.
   */

  /**
   * @slot {{ title: string }} header
   * Header content.
   */

  const dispatch = createEventDispatcher();
  $: dispatch("change", { value: "" });
</script>

<slot
  name="header"
  title=""
/>
<slot item="" />
