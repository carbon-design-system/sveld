<script context="module">
  /** Default glob */
  export const pattern = "src/**/*.svelte";
</script>

<script>
  /** Glob to match */
  export let glob = "src/**/*.svelte";

  /** Cron schedule */
  export let cron = "*/5 * * * *";

  export let re = /a*/g;

  export const fallback = "lib/**/*.js";
</script>

<!-- @component
Renders files matching `src/**/*.svelte`.
-->

<div>{glob} {cron} {re} {fallback}</div>
