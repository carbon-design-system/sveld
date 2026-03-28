import { SvelteComponentTyped } from "svelte";
import type { LinkProps } from "./Link.svelte";

export type OutboundLinkProps = LinkProps & {
  children?: (this: void) => void;
};

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
