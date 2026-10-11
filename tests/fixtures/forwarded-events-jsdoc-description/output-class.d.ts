import { SvelteComponentTyped } from "svelte";

export type ForwardedEventsJsdocDescriptionProps = Record<string, never>;

export default class ForwardedEventsJsdocDescription extends SvelteComponentTyped<
  ForwardedEventsJsdocDescriptionProps,
  {
    blur: WindowEventMap["blur"];
    /** Fired when the button is clicked */
    click: WindowEventMap["click"];
    /** Fired when the button receives focus */
    focus: WindowEventMap["focus"];
  },
  Record<string, never>
> {}
