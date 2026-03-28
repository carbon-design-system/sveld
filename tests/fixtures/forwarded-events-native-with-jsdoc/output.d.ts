import { SvelteComponentTyped } from "svelte";

export type ForwardedEventsNativeWithJsdocProps = {
  children?: (this: void) => void;
};

export default class ForwardedEventsNativeWithJsdoc extends SvelteComponentTyped<
  ForwardedEventsNativeWithJsdocProps,
  {
    /** Fired when the button loses focus */
    blur: WindowEventMap["blur"];
    /** Fired when the button is clicked */
    click: WindowEventMap["click"];
    /** Fired when the button receives focus */
    focus: WindowEventMap["focus"];
  },
  { default: Record<string, never> }
> {}
