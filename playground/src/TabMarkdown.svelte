<script lang="ts">
  export let parsed_component = {};
  export let moduleName = "";

  import pluginMarkdown from "prettier/plugins/markdown";
  import { format } from "prettier/standalone";
  import { writeMarkdownCore as writeMarkdown } from "../../src/writer/writer-markdown-core";
  import CodeHighlighter from "./CodeHighlighter.svelte";

  let markdown = "";
  let code = "";

  $: {
    try {
      const components = new Map([[moduleName, { ...parsed_component, moduleName }]]);
      markdown = writeMarkdown(components);
    } catch (error) {
      console.log(error);
      markdown = "";
    }
  }
  $: {
    format(markdown, {
      parser: "markdown",
      plugins: [pluginMarkdown],
    })
      .then((formatted) => {
        code = formatted;
      })
      .catch((error) => {
        console.log(error);
      });
  }
</script>

<CodeHighlighter noWrap language="markdown" {code} />
