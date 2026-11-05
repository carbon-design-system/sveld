<script lang="ts">
  import { Polymorphic } from "../types";

  export let tag: "div" | "section" = "div";

  // The tag decides the attributes: a div takes no `href`.
  export function typesOnly() {
    new Polymorphic({ target: document.body, props: { tag: "a", href: "/docs" } });
    // @ts-expect-error
    new Polymorphic({ target: document.body, props: { tag: "div", href: "/docs" } });
    // On an `img`, `width` is the component's boolean, not the attribute.
    new Polymorphic({ target: document.body, props: { tag: "img", width: true, src: "/a.png" } });
    // @ts-expect-error
    new Polymorphic({ target: document.body, props: { tag: "img", width: 10 } });
  }
</script>

<Polymorphic>default div</Polymorphic>
<Polymorphic {tag}>union tag</Polymorphic>
<Polymorphic tag="a" href="/docs">link</Polymorphic>
<Polymorphic tag="button" type="submit">button</Polymorphic>
<Polymorphic tag="img" width src="/a.png" />
