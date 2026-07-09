<script
  lang="ts"
  generics="const T extends readonly string[]"
>
  let { items }: { items: T } = $props();
</script>

<slot />
