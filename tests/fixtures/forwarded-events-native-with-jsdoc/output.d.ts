import type { SvelteComponentTyped } from "svelte";

export type ForwardedEventsNativeWithJsdocProps = {};

export default class ForwardedEventsNativeWithJsdoc extends SvelteComponentTyped<
  ForwardedEventsNativeWithJsdocProps,
  {
    /** Fired when the button is clicked */ click: WindowEventMap["click"];
    /** Fired when the button receives focus */
    focus: WindowEventMap["focus"];
    /** Fired when the button loses focus */
    blur: WindowEventMap["blur"];
  },
  { default: {} }
> {}
