<script
  lang="ts"
  generics="Tag extends keyof HTMLElementTagNameMap = 'div'"
>
  let { tag = "div" as Tag, ...rest }: { tag?: Tag; [key: string]: unknown } = $props();
</script>

<svelte:element
  this={tag}
  {...rest}
/>
