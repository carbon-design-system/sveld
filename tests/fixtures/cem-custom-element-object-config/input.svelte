<svelte:options
  customElement={{
    tag: "x-config-widget",
    shadow: "none",
    props: {
      variant: { attribute: "data-variant" },
      active: { reflect: true },
      tags: { type: "Array" }
    },
    extend: (ceClass) => ceClass
  }}
/>

<script lang="ts">
  export let variant: string = "default";
  export let active: boolean = false;
  export let tags: string[] = [];
</script>

<div data-variant={variant}>{variant}</div>
