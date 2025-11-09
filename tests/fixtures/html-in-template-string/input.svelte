<script>
  // Test case for issue #115: HTML tags in template literals should not cause parsing errors
  const css = `<style>body { color: white; }</style>`;
  const html = `<div><p>Hello world</p></div>`;

  export let message = "test";
</script>

<div>{message}</div>

<style>
  div {
    color: red;
  }
</style>
