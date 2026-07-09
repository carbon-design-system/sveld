<script lang="ts">
  export let parsed_component = {};
  export let moduleName = "";

  import json from "svelte-highlight/languages/json";
  import { buildCustomElementsManifest } from "../../src/browser";
  import CodeHighlighter from "./CodeHighlighter.svelte";

  let manifest = { schemaVersion: "1.0.0", modules: [] };

  $: {
    try {
      const filePath = `${moduleName}.svelte`;
      const components = new Map([[moduleName, { ...parsed_component, moduleName, filePath }]]);
      manifest = buildCustomElementsManifest(components);
    } catch (error) {
      console.log(error);
    }
  }
</script>

<CodeHighlighter
  language={json}
  code={JSON.stringify(manifest, null, 2)}
/>
