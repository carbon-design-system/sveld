<script>
  /**
   * @slot {{ prop: number; doubled: number; }}
   * @slot {{}} title
   * @slot {{ prop: number }} body - Customize the paragraph text.
   */

  let { prop = 0, children, title, body } = $props();
</script>

<h1>
  {@render children?.({ prop, doubled: prop * 2 })}
  {@render title?.()}
</h1>

<p>{@render body?.({ prop })}</p>
