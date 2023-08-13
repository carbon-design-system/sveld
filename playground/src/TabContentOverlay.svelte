<script>
  export let title = "";

  /** @type {"error" | "warning"} */
  export let kind = "error";
</script>

<div class="tab-content-overlay" class:error={kind === "error"} class:warning={kind === "warning"}>
  <h5>{title}</h5>
  <p>
    <slot />
  </p>
</div>

<style>
  .tab-content-overlay {
    position: absolute;
    z-index: 1;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 1rem;
    background: var(--cds-overlay-01);
    outline-offset: -2px;
  }

  :global([slot="content"]) {
    position: relative;
  }

  :global(.tab-content-overlay ~ [role="tabpanel"]) {
    opacity: 0.4;
  }

  .error {
    outline: 2px solid var(--cds-support-error);
  }

  .warning {
    outline: 2px solid var(--cds-support-warning);
  }

  p {
    margin: var(--cds-spacing-05) 0;
  }
</style>
