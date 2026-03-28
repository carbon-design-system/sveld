import { SvelteComponentTyped } from "svelte";

export type ForwardedEventsProps = {
  children?: (this: void) => void;
};

export default class ForwardedEvents extends SvelteComponentTyped<
  ForwardedEventsProps,
  {
    blur: WindowEventMap["blur"];
    click: WindowEventMap["click"];
    focus: WindowEventMap["focus"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: Record<string, never> }
> {}
