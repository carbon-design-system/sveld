<script lang="ts">
  export let parsed_component = {};
  export let moduleName = "";

  import pluginMarkdown from "prettier/plugins/markdown";
  import { format } from "prettier/standalone";
  import writeMarkdown from "../../src/writer/writer-markdown";
  import CodeHighlighter from "./CodeHighlighter.svelte";

  let markdown = "";
  let code = "";

  $: components = new Map([[moduleName, { ...parsed_component, moduleName }]]);
  $: writeMarkdown(components, { write: false })
    .then((result) => {
      markdown = result;
    })
    .catch((error) => {
      console.log(error);
    });
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
