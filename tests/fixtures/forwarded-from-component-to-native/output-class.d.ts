import { SvelteComponentTyped } from "svelte";

export type ForwardedFromComponentToNativeProps = Record<string, never>;

export default class ForwardedFromComponentToNative extends SvelteComponentTyped<
  ForwardedFromComponentToNativeProps,
  {
    click: WindowEventMap["click"];
    collapse: CustomEvent<null>;
    expand: CustomEvent<null>;
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  Record<string, never>
> {}
