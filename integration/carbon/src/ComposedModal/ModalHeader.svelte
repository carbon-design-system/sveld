<script>
  /** Specify the modal title */
  export let title = "";

  /** Specify the modal label */
  export let label = "";

  /** Specify the label class */
  export let labelClass = "";

  /** Specify the title class */
  export let titleClass = "";

  /** Specify the close class */
  export let closeClass = "";

  /** Specify the close icon class */
  export let closeIconClass = "";

  /** Specify the ARIA label for the close icon */
  export let iconDescription = "Close";

  import { getContext } from "svelte";
  import Close20 from "carbon-icons-svelte/lib/Close20/Close20.svelte";

  const { closeModal } = getContext("ComposedModal");
</script>

<div class:bx--modal-header={true} {...$$restProps}>
  {#if label}
    <p class:bx--modal-header__label={true} class:bx--type-delta={true} class={labelClass}>
      {label}
    </p>
  {/if}
  {#if title}
    <p class:bx--modal-header__heading={true} class:bx--type-beta={true} class={titleClass}>
      {title}
    </p>
  {/if}
  <slot />
  <button
    type="button"
    title={iconDescription}
    aria-label={iconDescription}
    class:bx--modal-close={true}
    class={closeClass}
    on:click
    on:click={closeModal}
  >
    <Close20 class="bx--modal-close__icon {closeIconClass}" />
  </button>
</div>
