<script context="module">
  // biome-ignore lint/style/useSingleVarDeclarator: each specifier must resolve to its own declarator
  const count = 1,
    label = "items";

  export { count, label as unit };
</script>

<script>
  // biome-ignore lint/style/useSingleVarDeclarator: each specifier must resolve to its own declarator
  let size = 1,
    kind = "primary";

  export { kind as variant, size };
</script>

<button class={kind}>{size}</button>
