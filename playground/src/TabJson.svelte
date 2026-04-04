<script lang="ts">
  export let parsed_component = {};

  import json from "svelte-highlight/languages/json";
  import CodeHighlighter from "./CodeHighlighter.svelte";
</script>

<CodeHighlighter
  language={json}
  code={JSON.stringify(parsed_component, null, 2)}
/>
