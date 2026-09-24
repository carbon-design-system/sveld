<script>
  /**
   * @event {null} go Go desc.
   * @typedef {object} Options Options desc
   * continued unindented.
   * @property {string} label Label desc.
   * @slot {{}} footer Footer desc
   * continued footer.
   * @cssprop {color} --accent Accent desc
   * continued accent.
   */

  import { createEventDispatcher } from "svelte";

  /** @type {Options} */
  export let options = { label: "" };

  const dispatch = createEventDispatcher();

  $: dispatch("go");
</script>

<slot name="footer" />
