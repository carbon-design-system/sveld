<script>
  export let parsed_component = {};
  export let moduleName = "";

  import plugin from "prettier/parser-markdown";
  import prettier from "prettier/standalone";
  import writeMarkdown from "../src/writer/writer-markdown";
  import CodeHighlighter from "./CodeHighlighter.svelte";

  let markdown = "";

  $: components = new Map([[moduleName, { ...parsed_component, moduleName }]]);
  $: writeMarkdown(components, { write: false })
    .then((result) => {
      markdown = result;
    })
    .catch((error) => {
      console.log(error);
    });
  $: code = prettier.format(markdown, {
    parser: "markdown",
    plugins: [plugin],
  });
</script>

<CodeHighlighter noWrap language="markdown" {code} />
