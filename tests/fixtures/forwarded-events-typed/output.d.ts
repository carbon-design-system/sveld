import type { SvelteComponentTyped } from "svelte";

export type ForwardedEventsTypedProps = {};

export default class ForwardedEventsTyped extends SvelteComponentTyped<
  ForwardedEventsTypedProps,
  {
    /** Fired when the button is clicked */ click: WindowEventMap["click"];
    /** Fired when the button receives focus */
    focus: WindowEventMap["focus"];
    blur: WindowEventMap["blur"];
  },
  {}
> {}
