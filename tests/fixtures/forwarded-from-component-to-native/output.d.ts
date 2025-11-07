import type { SvelteComponentTyped } from "svelte";

export type ForwardedFromComponentToNativeProps = Record<string, never>;

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
  Record<string, never>
> {}
