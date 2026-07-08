<script lang="ts">
  export let parsed_component = {};
  export let moduleName = "";

  import markdownLang from "svelte-highlight/languages/markdown";
  import { writeMarkdownCore as writeMarkdown } from "../../src/writer/writer-markdown-core";
  import CodeHighlighter from "./CodeHighlighter.svelte";

  let code = "";

  $: {
    try {
      const components = new Map([[moduleName, { ...parsed_component, moduleName }]]);
      code = writeMarkdown(components);
    } catch (error) {
      console.log(error);
      code = "";
    }
  }
</script>

<CodeHighlighter
  noWrap
  language={markdownLang}
  {code}
/>
