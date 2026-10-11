<script>
  /** URL patterns */
  export let patterns = {
    url: /https?:\/\//, // scheme and slashes
    quote: /"/,
  };

  /** Separators */
  export let separators = [
    "  ", // two spaces
    "a // b",
    `one
two`,
  ];
</script>

<div>{patterns.url} {separators.length}</div>
