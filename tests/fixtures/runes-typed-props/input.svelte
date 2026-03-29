<script>
  let {
    prop = true,
    /** @see https://github.com/ */
    prop1 = true,
    /**
     * This is a comment.
     * @type {boolean | string}
     */
    prop2 = true,
  } = $props();
</script>

{prop}
{prop1}
{prop2}
