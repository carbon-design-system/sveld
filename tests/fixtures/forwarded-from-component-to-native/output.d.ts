import type { SvelteComponentTyped } from "svelte";

export type ForwardedFromComponentToNativeProps = {};

export default class ForwardedFromComponentToNative extends SvelteComponentTyped<
  ForwardedFromComponentToNativeProps,
  {
    expand: CustomEvent<null>;
    collapse: CustomEvent<null>;
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
