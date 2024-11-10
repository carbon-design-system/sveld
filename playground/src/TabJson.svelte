<script>
  // @ts-check
  export let parsed_component = {};

  import CodeHighlighter from "./CodeHighlighter.svelte";
</script>

<CodeHighlighter language="json" code={JSON.stringify(parsed_component, null, 2)} />
