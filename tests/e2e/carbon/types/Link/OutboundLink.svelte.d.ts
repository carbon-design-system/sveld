import { SvelteComponentTyped } from "svelte";
import type { LinkProps } from "./Link.svelte";

type $Props = {
  children?: (this: void) => void;
};

export type OutboundLinkProps = Omit<LinkProps, keyof $Props> & $Props;

export default class OutboundLink extends SvelteComponentTyped<
  OutboundLinkProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: Record<string, never> }
> {}
