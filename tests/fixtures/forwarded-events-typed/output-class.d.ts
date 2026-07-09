import { SvelteComponentTyped } from "svelte";

export type ForwardedEventsTypedProps = Record<string, never>;

export default class ForwardedEventsTyped extends SvelteComponentTyped<
  ForwardedEventsTypedProps,
  {
    blur: WindowEventMap["blur"];
    /** Fired when the button is clicked */
    click: WindowEventMap["click"];
    /** Fired when the button receives focus */
    focus: WindowEventMap["focus"];
  },
  Record<string, never>
> {}
