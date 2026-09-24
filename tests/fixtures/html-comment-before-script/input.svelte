<!-- Module notes -->
<script context="module">
  export const version = "1";
</script>

<!-- @component
A component whose docs sit between its two scripts.
-->

<script>
  /** The label */
  export let label = "";
</script>

<!-- styles -->
<style>
  p {
    color: red;
  }
</style>

<p>{label}</p>
