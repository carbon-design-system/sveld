<script>
  export let quote = "";
  export let author = "";
</script>

<blockquote {...$$restProps}>
  <slot>{quote}</slot>
  <footer>– {author}</footer>
</blockquote>
