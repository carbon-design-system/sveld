<script lang="ts">
  import { Polymorphic } from "../types";

  export let tag: "div" | "section" = "div";
</script>

<Polymorphic>default div</Polymorphic>
<Polymorphic {tag}>union tag</Polymorphic>
<Polymorphic tag="a" href="/docs">link</Polymorphic>
<Polymorphic tag="button" type="submit">button</Polymorphic>
