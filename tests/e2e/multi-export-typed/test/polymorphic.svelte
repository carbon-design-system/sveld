<script lang="ts">
  import { Polymorphic } from "../types";

  export let tag: "div" | "section" = "div";

  // The tag decides the attributes: a div takes no `href`.
  export function typesOnly() {
    new Polymorphic({ target: document.body, props: { tag: "a", href: "/docs" } });
    // @ts-expect-error
    new Polymorphic({ target: document.body, props: { tag: "div", href: "/docs" } });
  }
</script>

<Polymorphic>default div</Polymorphic>
<Polymorphic {tag}>union tag</Polymorphic>
<Polymorphic tag="a" href="/docs">link</Polymorphic>
<Polymorphic tag="button" type="submit">button</Polymorphic>
