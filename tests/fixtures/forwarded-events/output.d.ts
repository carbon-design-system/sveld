import type { SvelteComponentTyped } from "svelte";

export type ForwardedEventsProps = {};

export default class ForwardedEvents extends SvelteComponentTyped<
  ForwardedEventsProps,
  {
    click: WindowEventMap["click"];
    focus: WindowEventMap["focus"];
    blur: WindowEventMap["blur"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: {} }
> {}
