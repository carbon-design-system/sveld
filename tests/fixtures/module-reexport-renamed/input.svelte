<script
  context="module"
  lang="ts"
>
  import { Helper, Component as Original } from "library";

  export { Helper, Original as Renamed };
</script>

<script>
  /** Controls visibility */
  export let visible = true;

  /** Configuration object */
  export let config = {};
</script>

<div class:visible><slot /></div>
