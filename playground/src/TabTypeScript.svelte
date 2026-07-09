<script lang="ts">
  export let parsed_component = {};
  export let moduleName = "";

  import typescript from "svelte-highlight/languages/typescript";
  import { writeTsDefinition } from "../../src/browser";
  import CodeHighlighter from "./CodeHighlighter.svelte";

  $: code = writeTsDefinition({
    ...parsed_component,
    moduleName,
  });
</script>

<CodeHighlighter
  language={typescript}
  {code}
/>
